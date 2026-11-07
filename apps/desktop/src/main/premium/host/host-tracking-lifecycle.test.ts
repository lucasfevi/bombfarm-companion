import { existsSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createPremiumTapFeedSlot } from '../../live-source/premium-tap-feed.js';
import type { KeepingSealedRows } from '../licence/licence-store.js';
import { createLogSink } from '../premium-test-support.js';
import type { BattleLogSource } from '../tracking/battle-log-tailer.js';
import { EngineOpenError, type LockedDb, type TrackingEngine } from '../tracking/engine.js';
import { subjectHash, TRACKING_DIR, trackingKeyRow } from '../tracking/tracking-store.js';
import type { HostTracking } from './host-runner.js';
import {
  createHostRig,
  flush,
  OTHER_SUBJECT,
  SUBJECT,
  topLevel,
  workerOptions,
  type HostRig,
} from './host-service-test-support.js';
import { createTrackingHost, type TrackingHost } from './tracking-host.js';

const CAPABILITIES = ['db', 'raw.tap', 'raw.battleLog', 'premium.worker'] as const;
const STORE_ROW = (subject: string): string => `premium_store_v1:${subject}`;

function memoryRows(): KeepingSealedRows & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    available: () => true,
    read: <T>(key: string, parse: (v: Record<string, unknown>) => T | null) => {
      const raw = map.get(key);
      return raw === undefined ? null : parse(JSON.parse(raw) as Record<string, unknown>);
    },
    readKept: <T>(key: string, parse: (v: Record<string, unknown>) => T | null) => {
      const raw = map.get(key);
      if (raw === undefined) return { ok: false, reason: 'absent' } as const;
      const value = parse(JSON.parse(raw) as Record<string, unknown>);
      return value === null ? ({ ok: false, reason: 'unreadable' } as const) : ({ ok: true, value } as const);
    },
    write: (key, json) => {
      map.set(key, json());
      return 'written';
    },
    delete: (key) => map.delete(key) || true,
  };
}

/** An engine whose opens create the file, as `ATTACH` does, and are counted. */
function fakeEngine() {
  const state = { opens: [] as string[], closed: 0 };
  const engine: TrackingEngine = {
    probe: () => Promise.resolve({ ok: true, version: 'v-test' }),
    open: async (file) => {
      state.opens.push(file);
      if (!existsSync(file)) await writeFile(file, 'created-by-attach');
      const raw: LockedDb = {
        run: () => Promise.resolve(),
        query: () => Promise.resolve([]),
        session: () => Promise.reject(new EngineOpenError('attach_failed')),
        close: () => {
          state.closed += 1;
        },
      };
      return raw;
    },
  };
  return { engine, state };
}

interface Shared {
  readonly root: string;
  readonly rows: ReturnType<typeof memoryRows>;
}

interface Ctx {
  r: HostRig;
  th: TrackingHost;
  /** What the runner told the tracking side, with how many workers had been killed at the time. */
  calls: string[];
  engine: ReturnType<typeof fakeEngine>['state'];
  rows: ReturnType<typeof memoryRows>;
  slot: ReturnType<typeof createPremiumTapFeedSlot>;
  who: { current: string | null };
  source: { text: string | null; mtimeMs: number };
  worker(): { call(c: string, a?: unknown): Promise<unknown>; on(n: string, f: (item: unknown) => void): void };
  file(subject?: string): string;
  posted(): { t: string; name?: string; items?: unknown[] }[];
}

const rigs: HostRig[] = [];
afterEach(async () => {
  for (const r of rigs.splice(0)) await r.dispose();
});

async function open(
  options: { capabilities?: readonly string[]; shared?: Shared; appVersion?: string; db?: HostRig['db'] } = {},
): Promise<Ctx> {
  const root = options.shared?.root ?? (await mkdtemp(join(tmpdir(), 'bfc-th-life-')));
  const rows = options.shared?.rows ?? memoryRows();
  const { engine, state } = fakeEngine();
  const slot = createPremiumTapFeedSlot();
  const who = { current: SUBJECT as string | null };
  const source = { text: null as string | null, mtimeMs: 1 };
  const battleLog: BattleLogSource = {
    stat: () => (source.text === null ? null : { mtimeMs: source.mtimeMs, size: source.text.length }),
    read: () => source.text,
    gameLanguage: () => null,
  };
  const th = createTrackingHost({
    root,
    rows,
    extensionPath: 'not-used',
    engine,
    feedSlot: slot,
    subject: () => who.current,
    playingAccountAllows: () => true,
    accountKey: () => '486',
    secrets: () => new Set(),
    battleLog: { source: battleLog },
    log: createLogSink(),
    now: () => 5,
    mono: () => 0,
  });
  const calls: string[] = [];
  const held: { rig?: HostRig } = {};
  const killed = (): number => held.rig?.fakes.forks.reduce((sum, fork) => sum + fork.child.killed, 0) ?? 0;
  const tracking: HostTracking = {
    stopFeeds: () => {
      calls.push(`stopFeeds killed=${String(killed())}`);
      th.stopFeeds();
    },
    pauseFeeds: () => {
      calls.push('pauseFeeds');
      th.pauseFeeds();
    },
    resumeFeeds: () => {
      calls.push('resumeFeeds');
      th.resumeFeeds();
    },
    close: () => {
      calls.push(`close killed=${String(killed())}`);
      return th.close();
    },
  };
  const rig = await createHostRig({
    root,
    ...(options.db === undefined ? {} : { db: options.db }),
    ...(options.appVersion === undefined ? {} : { appVersion: options.appVersion }),
    allowlist: new Map([
      ['db', th.handlers.db],
      ['raw.tap', th.handlers.rawTap],
      ['raw.battleLog', th.handlers.rawBattleLog],
      ['premium.worker', th.handlers.premiumWorker],
    ]),
    onChannel: (channel) => {
      th.attachChannel(channel);
    },
    tracking,
    deleteStore: (subject) => rows.delete(STORE_ROW(subject)),
  });
  held.rig = rig;
  rigs.push(rig);
  const r = rig;
  return {
    r,
    th,
    calls,
    engine: state,
    rows,
    slot,
    who,
    source,
    worker: () => r.workerHost() as unknown as ReturnType<Ctx['worker']>,
    file: (subject = SUBJECT) => join(root, TRACKING_DIR, `${subjectHash(subject)}.duckdb`),
    posted: () => (r.fakes.channels[0]?.port1.sent ?? []) as ReturnType<Ctx['posted']>,
  };
}

/** Sequence 4 running with the four tracking capabilities, the history file opened and its key written. */
async function running(options: Parameters<typeof open>[0] = {}): Promise<Ctx> {
  const c = await open(options);
  c.r.server.publish(workerOptions({ sequence: 4, capabilities: options.capabilities ?? [...CAPABILITIES] }));
  await c.r.runner.start(SUBJECT);
  c.r.runner.noteLatestSequence(4);
  c.r.gate.set(true);
  await flush(c.r);
  expect(c.r.runner.view().phase).toBe('running');
  if ((options.capabilities ?? CAPABILITIES).includes('db')) {
    await expect(c.worker().call('db', { op: 'status' })).resolves.toEqual({ state: 'ready' });
  }
  c.calls.length = 0;
  return c;
}

const keyKept = (c: Ctx, subject = SUBJECT): boolean => c.rows.map.has(trackingKeyRow(subject));

describe('the lifecycle of the tracking feeds and handle in the host runner', () => {
  it('pause: the feeds pause and the handle closes with the worker alive; resume re-arms the feeds and the next db call reopens', async () => {
    const c = await running();
    expect(c.engine.opens).toHaveLength(1);

    c.r.gate.set(false);
    await flush(c.r);

    expect(c.calls).toEqual(['pauseFeeds', 'close killed=0']);
    expect(c.engine.closed).toBe(1);
    expect(c.posted()).toContainEqual(expect.objectContaining({ t: 'paused' }));

    c.r.gate.set(true);
    await flush(c.r);

    expect(c.calls).toEqual(['pauseFeeds', 'close killed=0', 'resumeFeeds']);
    await expect(c.worker().call('db', { op: 'status' })).resolves.toEqual({ state: 'ready' });
    expect(c.engine.opens).toHaveLength(2);
    expect(c.engine.opens[1]).toBe(c.engine.opens[0]);
  });

  it('stop: the feeds stop first, then the worker is killed, then the handle closes', async () => {
    const c = await running();

    c.r.runner.mountFailed();
    await flush(c.r);

    expect(c.calls).toEqual(['stopFeeds killed=0', 'close killed=1']);
    expect(c.engine.closed).toBe(1);
    expect(existsSync(c.file())).toBe(true);
    expect(keyKept(c)).toBe(true);
  });

  it('a worker that crashes and is started again does not inherit the last one handle or feeds', async () => {
    const c = await running();

    c.r.fakes.forks[0]?.child.exit(1);
    await c.r.clock.advance(5_000);
    await flush(c.r);

    expect(c.r.fakes.forks).toHaveLength(2);
    expect(c.calls).toEqual(['stopFeeds killed=0', 'close killed=0']);
    expect(c.engine.closed).toBe(1);
  });

  it('signed out: the feeds stop and the handle closes, and the file and key stay', async () => {
    const c = await running();

    c.r.runner.signedOut();
    await flush(c.r);

    expect(c.calls[0]).toBe('stopFeeds killed=0');
    expect(c.calls.at(-1)).toBe('close killed=1');
    expect(c.engine.closed).toBe(1);
    expect(existsSync(c.file())).toBe(true);
    expect(keyKept(c)).toBe(true);
  });

  it('quit: the feeds stop first and the handle closes only after the supervisor has stopped the worker', async () => {
    const c = await running();

    c.r.runner.stop();
    await flush();

    expect(c.calls).toEqual(['stopFeeds killed=0', 'close killed=1']);
    expect(c.engine.closed).toBe(1);
    expect(c.r.fakes.forks[0]?.child.killed).toBe(1);
  });

  it('start for another subject: the old handle closes, the next db call opens that subject own file, the first stays', async () => {
    const c = await running();
    const first = c.file(SUBJECT);

    c.who.current = OTHER_SUBJECT;
    await c.r.runner.start(OTHER_SUBJECT);
    await flush(c.r);

    expect(c.calls[0]).toBe('stopFeeds killed=0');
    expect(c.calls.some((call) => call.startsWith('close'))).toBe(true);
    // The bundle is fetched again for the new subject, and its worker asks for its history.
    c.r.runner.noteLatestSequence(4);
    await flush(c.r);
    expect(c.r.runner.view().phase).toBe('running');
    await expect(c.worker().call('db', { op: 'status' })).resolves.toEqual({ state: 'ready' });

    const second = c.file(OTHER_SUBJECT);
    expect(second).not.toBe(first);
    expect(existsSync(first)).toBe(true);
    expect(existsSync(second)).toBe(true);
    expect(keyKept(c, SUBJECT)).toBe(true);
    expect(keyKept(c, OTHER_SUBJECT)).toBe(true);
    expect(c.rows.map.get(trackingKeyRow(SUBJECT))).not.toBe(c.rows.map.get(trackingKeyRow(OTHER_SUBJECT)));
  });
});

describe('nothing but a clear removes the history file or its key', () => {
  it.each(['ended', 'moved', 'released'] as const)(
    'removal (%s) deletes the store row and the bundle folder, and leaves the history file and its key',
    async (reason) => {
      const c = await running();
      c.rows.map.set(STORE_ROW(SUBJECT), '{"v":1}');

      c.r.runner.requestPremiumRemoval(reason);
      await flush(c.r);

      expect(c.rows.map.has(STORE_ROW(SUBJECT))).toBe(false);
      expect(c.r.goneCalls).toBe(1);
      expect(await topLevel(c.r.root)).toEqual([TRACKING_DIR]);
      expect(c.calls.some((call) => call.startsWith('close'))).toBe(true);
      expect(existsSync(c.file())).toBe(true);
      expect(keyKept(c)).toBe(true);
    },
  );

  it('a bundle update that swaps the running bundle leaves them', async () => {
    const c = await running();
    c.r.server.publish(workerOptions({ sequence: 5, capabilities: [...CAPABILITIES] }));
    c.r.runner.noteLatestSequence(5);
    await flush(c.r);

    c.r.runner.noteLeaseFloor(5);
    await flush(c.r);

    expect(c.r.runner.runningSequence()).toBe(5);
    expect(c.r.fakes.forks).toHaveLength(2);
    expect(existsSync(c.file())).toBe(true);
    expect(keyKept(c)).toBe(true);
    await expect(c.worker().call('db', { op: 'status' })).resolves.toEqual({ state: 'ready' });
    expect(c.engine.opens.at(-1)).toBe(c.file());
  });

  it('a Lease failure that raises the floor past every bundle leaves them', async () => {
    const c = await running();

    c.r.runner.noteLeaseFloor(99);
    await flush(c.r);

    expect(c.r.runner.view().phase).not.toBe('running');
    expect(existsSync(c.file())).toBe(true);
    expect(keyKept(c)).toBe(true);
  });

  it('a lapsed Lease (the gate closing) leaves them', async () => {
    const c = await running();

    c.r.gate.set(false);
    await flush(c.r);

    expect(existsSync(c.file())).toBe(true);
    expect(keyKept(c)).toBe(true);
  });

  it('a bundle refused for the app version at the next start leaves them', async () => {
    const c = await running();
    c.r.runner.stop();
    await c.r.runner.idle();
    const shared = { root: c.r.root, rows: c.rows };

    // The cached bundle now asks for a newer app than this one, so it is discarded.
    const next = await open({ shared, db: c.r.db, appVersion: '0.0.1' });
    next.r.server.publish(workerOptions({ sequence: 4, minAppVersion: '9.0.0', capabilities: [...CAPABILITIES] }));
    await next.r.runner.start(SUBJECT);
    next.r.gate.set(true);
    await flush(next.r);

    expect(next.r.runner.view().phase).not.toBe('running');
    expect(existsSync(next.file())).toBe(true);
    expect(keyKept(next)).toBe(true);
  });

  it('dropCache (the cache belonged to another subject) leaves them', async () => {
    const c = await running();
    c.r.db.rows.set('premium_bundle_seq_v1', JSON.stringify({ subject: OTHER_SUBJECT, sequence: 4 }));

    await c.r.runner.start(SUBJECT);
    await flush(c.r);

    expect(existsSync(c.file())).toBe(true);
    expect(keyKept(c)).toBe(true);
  });
});

describe('the feeds follow the worker', () => {
  const frame = { op: 'tick' };
  const delivered = (c: Ctx): number =>
    c.posted().filter((message) => message.t === 'events' && message.name === 'raw.tap').length;
  const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  it('delivers a tap frame to a subscribed worker, nothing while paused, and nothing after the worker stops', async () => {
    const c = await running();
    await c.worker().call('raw.tap', { op: 'subscribe' });

    c.slot.sink.frame(frame, 10);
    await wait(150);
    await flush();
    expect(delivered(c)).toBe(1);

    c.r.gate.set(false);
    await flush(c.r);
    c.slot.sink.frame(frame, 11);
    await wait(150);
    expect(delivered(c)).toBe(1);

    c.r.gate.set(true);
    await flush(c.r);
    c.slot.sink.frame(frame, 12);
    await wait(150);
    await flush();
    expect(delivered(c)).toBe(2);

    c.r.runner.mountFailed();
    await flush(c.r);
    c.slot.sink.frame(frame, 13);
    await wait(150);
    expect(delivered(c)).toBe(2);
  });

  it('the next worker starts with no subscription, whatever the last one asked for', async () => {
    const c = await running();
    await c.worker().call('raw.tap', { op: 'subscribe' });
    c.r.fakes.forks[0]?.child.exit(1);
    await c.r.clock.advance(5_000);
    await flush(c.r);

    c.slot.sink.frame(frame, 20);
    await wait(150);

    expect(c.r.fakes.channels[2]?.port1.sent.filter((m) => (m as { t: string }).t === 'events')).toEqual([]);
  });

  it('sends the battle log with a baseline after each resume', async () => {
    const c = await running();
    c.source.text = '[acc_486]\nentries=[1]\n';
    await c.worker().call('raw.battleLog', { op: 'subscribe' });
    await flush();
    const baselines = (): boolean[] =>
      c
        .posted()
        .filter((m) => m.t === 'events' && m.name === 'raw.battleLog')
        .flatMap((m) => (m.items ?? []) as { baseline: boolean }[])
        .map((item) => item.baseline);
    expect(baselines()).toEqual([true]);

    c.r.gate.set(false);
    await flush(c.r);
    c.source.text = '[acc_486]\nentries=[1,2]\n';
    c.source.mtimeMs = 2;
    c.r.gate.set(true);
    await flush(c.r);

    expect(baselines()).toEqual([true, true]);
  });
});

describe('a clear while a worker runs', () => {
  const cleared = (c: Ctx): unknown[] =>
    c.posted().filter((m) => m.t === 'events' && m.name === 'db.cleared');

  it('posts one db.cleared to the same subject worker, and deletes the file and key', async () => {
    const c = await running();
    const heard: unknown[] = [];
    c.worker().on('db.cleared', (item) => heard.push(item));

    await expect(c.th.clear(SUBJECT)).resolves.toBe('cleared');
    await flush(c.r);

    expect(cleared(c)).toHaveLength(1);
    expect(heard).toEqual([{ atMs: 5 }]);
    expect(existsSync(c.file())).toBe(false);
    expect(keyKept(c)).toBe(false);
    await expect(c.th.clear(SUBJECT)).resolves.toBe('cleared');
    expect(cleared(c)).toHaveLength(2);
  });

  it('posts nothing for another subject, or to a worker without the db grant', async () => {
    const c = await running();
    await expect(c.th.clear(OTHER_SUBJECT)).resolves.toBe('cleared');
    expect(cleared(c)).toEqual([]);

    const bare = await running({ capabilities: ['raw.tap'] });
    await expect(bare.th.clear(SUBJECT)).resolves.toBe('cleared');
    expect(cleared(bare)).toEqual([]);
  });

  it('works with no worker running, and tells Settings what is on disk', async () => {
    const c = await running();
    expect(c.th.history(SUBJECT)).toEqual({ state: 'present', bytes: expect.any(Number) as number });

    c.r.runner.signedOut();
    await flush(c.r);
    await expect(c.th.clear(SUBJECT)).resolves.toBe('cleared');

    expect(c.th.history(SUBJECT)).toEqual({ state: 'none' });
    expect(cleared(c)).toEqual([]);
  });
});
