import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CapabilityReply } from '@bombfarm/contracts';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createPremiumTapFeedSlot } from '../../live-source/premium-tap-feed.js';
import type { LogPort } from '../../storage/index.js';
import type { KeepingSealedRows } from '../licence/licence-store.js';
import type { BattleLogSource } from '../tracking/battle-log-tailer.js';
import { createTrackingEngine } from '../tracking/engine.js';
import { currentPlatformExtension } from '../tracking/test-extension.js';
import { createCapabilityChannel, type CapabilityChannel, type CapabilityHandler, type CapabilityPort } from './capability-channel.js';
import { createTrackingHost } from './tracking-host.js';
import { createLogSink } from '../premium-test-support.js';
import { SECRETS } from '../premium-test-support.js';
import { DEVICE_ID, MACHINE_GUID, SALT, USER } from '../licence/licence-test-support.js';
import { createFakeFork } from './host-fakes.js';
import {
  createHostRig,
  ECHO_CAPABILITY,
  flush,
  SUBJECT,
  workerOptions,
  type HostRig,
} from './host-service-test-support.js';
import { createWorkerSupervisor } from './worker-supervisor.js';

/** The host's own source files: everything beside this folder's tests and test support. */
function hostSources(): Array<{ name: string; text: string }> {
  return readdirSync(__dirname)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts'))
    .filter((name) => !/(^|-)(fakes|test-support)\.ts$/.test(name))
    .map((name) => ({ name, text: readFileSync(join(__dirname, name), 'utf8') }));
}

/** Every `postMessage(...)` call in a source, with its argument text; declarations are skipped. */
function postMessageCalls(text: string): string[] {
  const calls: string[] = [];
  let from = 0;
  for (;;) {
    const at = text.indexOf('postMessage(', from);
    if (at === -1) return calls;
    from = at + 'postMessage('.length;
    let depth = 1;
    let end = from;
    while (end < text.length && depth > 0) {
      const char = text[end];
      if (char === '(') depth += 1;
      else if (char === ')') depth -= 1;
      end += 1;
    }
    const argument = text
      .slice(from, end - 1)
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/,$/, '');
    const after = text.slice(end).trimStart();
    const declaration = after.startsWith(':') || after.startsWith('{');
    if (!declaration) calls.push(argument);
  }
}

/**
 * The calls the host may make, per file. A message to the worker is built by the one `toWorker`
 * function (or is the typed reply the capability channel posts); the other two calls are the worker's
 * own code going over its dedicated port, and the loader answering in the other direction.
 */
const ALLOWED_CALLS: Readonly<Record<string, readonly string[]>> = {
  'capability-channel.ts': ['message'],
  'worker-loader.ts': ['{ id, capability, args }', "{ t: 'ack', seq }", 'reply'],
  'worker-supervisor.ts': [
    "toWorker({ t: 'init', sequence: bundle.sequence, version: bundle.version, granted: channel.granted }), [capability.port2, code.port2]",
    'bundle.workerBytes.slice().buffer',
  ],
};

function violations(sources: ReadonlyArray<{ name: string; text: string }>): string[] {
  const found: string[] = [];
  for (const { name, text } of sources) {
    const calls = postMessageCalls(text);
    const allowed = [...(ALLOWED_CALLS[name] ?? [])];
    for (const call of calls) {
      const index = allowed.indexOf(call);
      if (index === -1) found.push(`${name}: postMessage(${call})`);
      else allowed.splice(index, 1);
    }
  }
  return found;
}

describe('every message to a Premium worker is built in one place', () => {
  it('finds only the known postMessage call sites under the host folder', () => {
    const sources = hostSources();
    expect(sources.length).toBeGreaterThan(5);
    expect(violations(sources)).toEqual([]);
  });

  it('finds the supervisor and channel call sites, so the scan is not vacuous', () => {
    const seen = hostSources().map(({ name, text }) => [name, postMessageCalls(text).length] as const);
    expect(Object.fromEntries(seen.filter(([, count]) => count > 0))).toEqual({
      'capability-channel.ts': 1,
      'worker-loader.ts': 3,
      'worker-supervisor.ts': 2,
    });
  });

  it('fails on a planted raw message in a new file', () => {
    const planted = { name: 'planted.ts', text: 'export const leak = (child: Child, token: string) => child.postMessage({ token });' };
    expect(violations([...hostSources(), planted])).toEqual(['planted.ts: postMessage({ token })']);
  });

  it('fails on a raw message planted beside the supervisor’s own', () => {
    const supervisor = hostSources().find((source) => source.name === 'worker-supervisor.ts');
    const planted = { name: 'worker-supervisor.ts', text: `${supervisor?.text ?? ''}\nchild.postMessage({ salt });\n` };
    expect(violations([planted])).toEqual(['worker-supervisor.ts: postMessage({ salt })']);
  });

  it('fails when the init message stops going through the one builder', () => {
    const supervisor = hostSources().find((source) => source.name === 'worker-supervisor.ts');
    const changed = (supervisor?.text ?? '').replace('toWorker({', '({');
    expect(violations([{ name: 'worker-supervisor.ts', text: changed }])).not.toEqual([]);
  });
});

const SESSION_TOKEN = SECRETS.token;
const SIGN_IN_TOKEN = SECRETS.rotatedToken;
const DEVICE_PRIVATE_KEY = 'MC4CAQAwBQYDK2VwBCIEIdevice-private-key-marker-5521';
const CAPABILITY_ARGS_MARKER = 'capability-args-marker-3317';

const SECRET_MARKERS: ReadonlyArray<[string, string]> = [
  ['session token', SESSION_TOKEN],
  ['sign-in token', SIGN_IN_TOKEN],
  ['device private key', DEVICE_PRIVATE_KEY],
  ['fingerprint salt', SALT],
  ['fingerprint salt bytes', Buffer.from(SALT, 'base64url').toString('hex')],
  ['machine guid', MACHINE_GUID],
  ['device id', DEVICE_ID],
  ['subject', USER],
  ['SteamID', SECRETS.steamId64],
  ['game account id', SECRETS.accountId],
];

let rig: HostRig | null = null;
afterEach(async () => {
  await rig?.dispose();
  rig = null;
});

/** Text a record could carry a file's bytes as: raw, hex or base64. */
function renderings(bytes: Uint8Array): string[] {
  const buffer = Buffer.from(bytes);
  return [buffer.toString('utf8'), buffer.toString('hex'), buffer.toString('base64'), buffer.toString('base64url')];
}

describe('a fixture run through the runner keeps secrets out of messages, views and logs', () => {
  it('shows no secret, bundle byte or capability argument outside the worker’s own code', async () => {
    rig = await createHostRig();
    const r = rig;
    const input = r.server.publish(workerOptions({ sequence: 4 }));
    await r.runner.start(SUBJECT);
    r.runner.noteLatestSequence(4);
    r.gate.set(true);
    await flush(r);

    expect(r.runner.view().phase).toBe('running');
    const reply = await r.workerHost()?.call(ECHO_CAPABILITY, { marker: CAPABILITY_ARGS_MARKER, token: SESSION_TOKEN });
    expect(reply).toBe('pong');
    await r.workerHost()?.call('not.granted', { marker: CAPABILITY_ARGS_MARKER }).catch(() => undefined);
    r.gate.set(false);
    await flush(r);
    r.gate.set(true);
    await flush(r);

    const logs = JSON.stringify(r.log.records);
    const views = JSON.stringify([r.runner.view(), r.views]);
    // What reaches the worker over the capability and init paths; the code port carries the worker's own file.
    const toWorker = JSON.stringify([
      r.fakes.forks.flatMap((fork) => fork.child.posted.map((post) => post.message)),
      r.fakes.channels.filter((_, index) => index % 2 === 0).flatMap((channel) => channel.port1.sent),
    ]);
    expect(r.log.records.map((record) => record['event'])).toContain('premium.capability');

    const bundleText = [...input.files.values()].flatMap(renderings);
    const manifestText = [...renderings(input.manifestBytes), ...renderings(input.sig)];
    const sensitive: Array<[string, string]> = [
      ...SECRET_MARKERS,
      ['capability argument', CAPABILITY_ARGS_MARKER],
      ...[...bundleText, ...manifestText].filter((text) => text.length > 8).map((text): [string, string] => ['bundle bytes', text]),
    ];
    for (const [name, value] of sensitive) {
      expect(logs, `a log record holds the ${name}`).not.toContain(value);
      expect(views, `a view holds the ${name}`).not.toContain(value);
      expect(toWorker, `a message to the worker holds the ${name}`).not.toContain(value);
    }
    expect(JSON.stringify(r.log.records)).not.toContain('args');
  });

  it('gives the worker process a three-variable environment however many secrets the host holds', () => {
    const fakes = createFakeFork();
    const log = createLogSink();
    const supervisor = createWorkerSupervisor({
      fork: fakes.fork,
      createChannel: fakes.createChannel,
      loaderPath: 'premium-worker.cjs',
      vars: {
        SYSTEMROOT: 'C:\\Windows',
        TEMP: 'C:\\Temp',
        TMP: 'C:\\Temp',
        SESSION_TOKEN,
        SIGN_IN_TOKEN,
        DEVICE_PRIVATE_KEY,
        FINGERPRINT_SALT: SALT,
        STEAM_ID: SECRETS.steamId64,
      },
      allowlist: new Map(),
      now: () => 0,
      log,
    });

    supervisor.start({ sequence: 4, version: '1.0.0', workerBytes: new Uint8Array([1, 2, 3]), requested: [] });

    const seen = JSON.stringify([
      fakes.forks.map((fork) => [fork.modulePath, fork.args, fork.options, fork.child.posted.map((post) => post.message)]),
      log.records,
    ]);
    for (const [name, value] of SECRET_MARKERS) {
      expect(seen, `the worker process or a log holds the ${name}`).not.toContain(value);
    }
    expect(Object.keys(fakes.forks[0]?.options.env ?? {}).sort()).toEqual(['SYSTEMROOT', 'TEMP', 'TMP']);
  });
});

const PLAYER_NAME = 'player-name-marker-6602';
const ACCOUNT_ID = SECRETS.accountId;

/** Every value that must reach no message, `db` answer, `ui` message or log, wherever it is planted. */
const FORBIDDEN: ReadonlyArray<[string, string]> = SECRET_MARKERS.filter(([name]) => name !== 'game account id');
/** The two that may travel, and only inside `raw.tap` and `raw.battleLog` items. */
const GAME_IDENTITY: ReadonlyArray<[string, string]> = [
  ['game account id', ACCOUNT_ID],
  ['player name', PLAYER_NAME],
];

interface Captured {
  readonly posted: readonly unknown[];
  readonly log: readonly unknown[];
  readonly views: readonly unknown[];
  /** Strings the host itself holds that no answer may repeat: the file location and the sealed key. */
  readonly held: ReadonlyArray<[string, string]>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isRawFeed = (message: unknown): boolean =>
  isRecord(message) && message['t'] === 'events' && (message['name'] === 'raw.tap' || message['name'] === 'raw.battleLog');

/** Where each marker came out, as `surface: marker`; empty when the sweep is clean. */
function sweep(captured: Captured): string[] {
  const found: string[] = [];
  const surfaces: Array<[string, readonly unknown[]]> = [
    ['message', captured.posted],
    ['log', captured.log],
    ['view', captured.views],
  ];
  for (const [surface, records] of surfaces) {
    const text = JSON.stringify(records);
    for (const [name, value] of [...FORBIDDEN, ...captured.held]) {
      if (text.includes(value)) found.push(`${surface}: ${name}`);
    }
  }
  const outsideRawFeeds: Array<[string, readonly unknown[]]> = [
    ['message outside raw items', captured.posted.filter((message) => !isRawFeed(message))],
    ['log', captured.log],
    ['view', captured.views],
  ];
  for (const [surface, records] of outsideRawFeeds) {
    const text = JSON.stringify(records);
    for (const [name, value] of GAME_IDENTITY) {
      if (text.includes(value)) found.push(`${surface}: ${name}`);
    }
  }
  return found;
}

describe('the sweep itself', () => {
  const clean: Captured = { posted: [{ t: 'events', name: 'raw.tap', items: [{ accountKey: ACCOUNT_ID }] }], log: [], views: [], held: [] };

  it('accepts the game identity inside a raw item and nothing else', () => {
    expect(sweep(clean)).toEqual([]);
  });

  it('flags every forbidden marker on every surface, and the game identity outside raw items', () => {
    for (const [name, value] of FORBIDDEN) {
      expect(sweep({ ...clean, posted: [{ t: 'events', name: 'raw.tap', items: [{ x: value }] }] }), name).toEqual([`message: ${name}`]);
      expect(sweep({ ...clean, log: [{ note: value }] }), name).toEqual([`log: ${name}`]);
      expect(sweep({ ...clean, views: [{ note: value }] }), name).toEqual([`view: ${name}`]);
    }
    expect(sweep({ ...clean, posted: [{ id: 1, ok: true, value: PLAYER_NAME }] })).toEqual(['message outside raw items: player name']);
    expect(sweep({ ...clean, log: [{ id: ACCOUNT_ID }] })).toEqual(['log: game account id']);
  });
});

/** The raw frame and body the tap observes: every marker planted by value, by key, and nested. */
const PLANTED = {
  type: 'state',
  coins: 5,
  account_id: ACCOUNT_ID,
  player_name: PLAYER_NAME,
  token: SESSION_TOKEN,
  signInToken: SIGN_IN_TOKEN,
  deviceKey: DEVICE_PRIVATE_KEY,
  note: `signed ${SIGN_IN_TOKEN}`,
  steam: SECRETS.steamId64,
  salt: SALT,
  saltHex: Buffer.from(SALT, 'base64url').toString('hex'),
  machine: MACHINE_GUID,
  device: DEVICE_ID,
  subject: USER,
  list: ['plain', `via ${SESSION_TOKEN}`, SECRETS.steamId64],
  nested: { kept: 1, leak: `at ${MACHINE_GUID}`, deeper: { id: DEVICE_ID, fine: 'yes' } },
};
/** What is left of it once the scrub has run. */
const SCRUBBED = {
  type: 'state',
  coins: 5,
  account_id: ACCOUNT_ID,
  player_name: PLAYER_NAME,
  list: ['plain'],
  nested: { kept: 1, deeper: { fine: 'yes' } },
};

const BATTLE_LOG = [
  `[acc_${ACCOUNT_ID}]`,
  `name=${PLAYER_NAME}`,
  'entries=[{"k":1}]',
  '[acc_someone-else-77]',
  `leak=${FORBIDDEN.map(([, value]) => value).join(' ')}`,
  `name=${FORBIDDEN.map(([, value]) => value).join(' ')}`,
  'entries=[]',
].join('\n');

describe('planted markers through the real tracking host', () => {
  let scratch = '';
  let extension = '';
  let counter = 0;

  beforeAll(async () => {
    scratch = mkdtempSync(join(tmpdir(), 'bfc-sweep-'));
    extension = await currentPlatformExtension();
  }, 120_000);
  afterAll(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

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

  async function until(condition: () => boolean, what: string): Promise<void> {
    for (let waited = 0; waited < 8_000; waited += 10) {
      if (condition()) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`timed out waiting for ${what}`);
  }

  function build() {
    const root = join(scratch, MACHINE_GUID, DEVICE_ID, String((counter += 1)));
    mkdirSync(root, { recursive: true });
    const records: Record<string, unknown>[] = [];
    const keep = (record: Record<string, unknown>): void => {
      records.push(record);
    };
    const log: LogPort = { info: keep, warn: keep, error: keep };
    const rows = memoryRows();
    const slot = createPremiumTapFeedSlot();
    const source: BattleLogSource = {
      stat: () => ({ mtimeMs: 1_000, size: BATTLE_LOG.length }),
      read: () => BATTLE_LOG,
      gameLanguage: () => 'en',
    };
    const host = createTrackingHost({
      root,
      rows,
      extensionPath: extension,
      engine: createTrackingEngine({ extensionPath: extension, log }),
      feedSlot: slot,
      subject: () => USER,
      playingAccountAllows: () => true,
      accountKey: () => ACCOUNT_ID,
      secrets: () => new Set(FORBIDDEN.map(([, value]) => value)),
      battleLog: { source },
      log,
      now: () => Date.now(),
      mono: () => performance.now(),
    });

    const posted: unknown[] = [];
    const listeners: Array<(event: { data: unknown }) => unknown> = [];
    const port: CapabilityPort = {
      on: (_event, listener) => {
        listeners.push(listener);
      },
      postMessage: (message) => {
        posted.push(message);
      },
      start: () => undefined,
      close: () => undefined,
    };
    const allowlist = new Map<string, CapabilityHandler>([
      ['db', host.handlers.db],
      ['raw.tap', host.handlers.rawTap],
      ['raw.battleLog', host.handlers.rawBattleLog],
      ['premium.worker', host.handlers.premiumWorker],
    ]);
    const channel: CapabilityChannel = createCapabilityChannel({
      port,
      requested: [...allowlist.keys()],
      allowlist,
      sequence: 4,
      now: () => performance.now(),
      log,
      ratePerMinute: 6_000,
    });
    host.attachChannel(channel);

    let nextId = 1;
    let acked = 0;
    const fromWorker = (data: unknown): void => {
      for (const listener of listeners) listener({ data });
    };
    const replyTo = (id: number): CapabilityReply | undefined =>
      posted.find((message): message is CapabilityReply => isRecord(message) && message['id'] === id && 'ok' in message);
    async function worker(capability: string, args: unknown): Promise<CapabilityReply> {
      const id = nextId++;
      fromWorker({ id, capability, args });
      await until(() => replyTo(id) !== undefined, `the reply to ${capability}`);
      return replyTo(id) as CapabilityReply;
    }
    const screen = (capability: string, args: unknown): Promise<CapabilityReply> =>
      channel.callFromUi({ id: nextId++, capability, args });
    const feedItems = (name: string): unknown[] =>
      posted.flatMap((message) =>
        isRecord(message) && message['t'] === 'events' && message['name'] === name ? (message['items'] as unknown[]) : [],
      );
    const question = (): { id: number } =>
      posted.find((message) => isRecord(message) && message['t'] === 'ui') as { id: number };
    /** The screen asks the worker; the worker answers, as the loader does. */
    async function ask(msg: unknown, answer: unknown): Promise<CapabilityReply> {
      const asking = screen('premium.worker', msg);
      await until(() => posted.some((message) => isRecord(message) && message['t'] === 'ui'), 'the question to the worker');
      fromWorker({ t: 'uiReply', id: question().id, ok: true, value: answer });
      return asking;
    }

    const views: unknown[] = [];
    function captured(): Captured {
      const keyRow = [...rows.map.values()].join(' ');
      const sealed = /[0-9a-f]{64}/.exec(keyRow)?.[0];
      return {
        posted,
        log: records,
        views,
        held: [
          ['db file location', root],
          ['db file name', '.duckdb'],
          ...(sealed === undefined ? [] : ([['sealed key', sealed]] as Array<[string, string]>)),
        ],
      };
    }
    return {
      host,
      slot,
      channel,
      worker,
      screen,
      ask,
      feedItems,
      fromWorker,
      posted,
      records,
      views,
      captured,
      /** Acknowledges every feed batch seen so far, as the worker's loader does. */
      ackAll(): void {
        for (const message of posted.slice(acked)) {
          if (isRecord(message) && message['t'] === 'events' && typeof message['seq'] === 'number') {
            fromWorker({ t: 'ack', seq: message['seq'] });
          }
        }
        acked = posted.length;
      },
      async dispose(): Promise<void> {
        host.dispose();
        await host.close();
        channel.close();
      },
    };
  }

  let rig: ReturnType<typeof build> | null = null;
  afterEach(async () => {
    await rig?.dispose();
    rig = null;
  });

  it('keeps every credential out of tap, battle-log, db and ui traffic and lets the game identity out only in raw items', async () => {
    rig = build();
    const r = rig;

    // raw.tap and raw.battleLog: the worker subscribes; the game then sends planted frames and bodies.
    expect((await r.worker('raw.tap', { op: 'subscribe' })).ok).toBe(true);
    expect((await r.worker('raw.battleLog', { op: 'subscribe' })).ok).toBe(true);
    r.slot.sink.frame(PLANTED, 1_000);
    r.slot.sink.body(Buffer.from(JSON.stringify(PLANTED)), 1_001);
    await until(() => r.feedItems('raw.tap').length === 2 && r.feedItems('raw.battleLog').length === 1, 'the feeds');
    r.ackAll();

    // Positive controls: the items are there and keep what is allowed, so the sweep is not vacuous.
    expect(r.feedItems('raw.tap')).toEqual([
      { kind: 'frame', seq: 1, atMs: 1_000, accountKey: ACCOUNT_ID, wire: SCRUBBED },
      { kind: 'body', seq: 2, atMs: 1_001, accountKey: ACCOUNT_ID, body: SCRUBBED },
    ]);
    const [battleLog] = r.feedItems('raw.battleLog') as Array<Record<string, unknown>>;
    expect(battleLog?.['text']).toBe(`name=${PLAYER_NAME}\nentries=[{"k":1}]`);
    expect(battleLog?.['section']).toBe(`acc_${ACCOUNT_ID}`);

    // db from the worker: writes, reads, and refusals with every marker in the SQL text and parameters.
    expect((await r.worker('db', { op: 'status' })).ok).toBe(true);
    expect((await r.worker('db', { op: 'exec', sql: 'CREATE TABLE t(k VARCHAR, v VARCHAR)' })).ok).toBe(true);
    expect((await r.worker('db', { op: 'batch', sql: 'INSERT INTO t VALUES ($1, $2)', rows: [['a', '1'], ['b', '2']] })).ok).toBe(true);
    expect((await r.worker('db', { op: 'tx', steps: [{ sql: 'INSERT INTO t VALUES ($1, $2)', params: ['c', '3'] }] })).ok).toBe(true);
    const read = await r.worker('db', { op: 'query', sql: 'SELECT k, v FROM t ORDER BY k' });
    expect(read).toMatchObject({ ok: true, value: { columns: ['k', 'v'], rows: [['a', '1'], ['b', '2'], ['c', '3']] } });
    expect((await r.worker('db', { op: 'size' })).ok).toBe(true);
    const planted = FORBIDDEN.map(([, value]) => value);
    const refusals = [
      await r.worker('db', { op: 'exec', sql: 'INSERT INTO missing_table VALUES ($1)', params: [SESSION_TOKEN] }),
      await r.worker('db', { op: 'query', sql: `SELECT '${SIGN_IN_TOKEN}' FROM missing_${DEVICE_ID.replace(/-/g, '_')}` }),
      await r.worker('db', { op: 'query', sql: `SELECT getenv('${MACHINE_GUID}')` }),
      await r.worker('db', { op: 'exec', sql: `CREATE SECRET s (TYPE s3, KEY_ID '${DEVICE_PRIVATE_KEY}')` }),
      await r.worker('db', { op: 'batch', sql: 'INSERT INTO t VALUES ($1, $2)', rows: [planted] }),
      await r.worker('db', { op: USER, sql: planted.join(' ') }),
    ];
    for (const refusal of refusals) expect(refusal.ok).toBe(false);

    // db and premium.worker from the screen.
    expect(await r.screen('db', { op: 'query', sql: 'SELECT k FROM t ORDER BY k' })).toMatchObject({ ok: true });
    expect((await r.screen('db', { op: 'exec', sql: `DELETE FROM t WHERE k = '${SALT}'` })).ok).toBe(false);
    expect((await r.screen('db', { op: 'status' })).ok).toBe(true);
    expect(await r.ask({ ask: 'summary', limit: 3 }, { rows: 3, label: 'fine' })).toMatchObject({
      ok: true,
      value: { rows: 3, label: 'fine' },
    });

    // The Settings row, then clear: the worker hears the event and no view holds a secret.
    r.views.push(r.host.history(USER));
    expect(await r.host.clear(USER)).toBe('cleared');
    await until(() => r.posted.some((message) => isRecord(message) && message['name'] === 'db.cleared'), 'db.cleared');
    r.views.push(r.host.history(USER));

    expect(sweep(r.captured())).toEqual([]);
    const audits = r.records.filter((record) => record['event'] === 'premium.db' || record['event'] === 'premium.worker_message');
    expect(audits.length).toBeGreaterThan(8);
  }, 60_000);

  it('logs a ui message and its answer by outcome only, wherever a marker sits in them', async () => {
    rig = build();
    const r = rig;

    const reply = await r.ask({ ask: SESSION_TOKEN, note: PLAYER_NAME }, { echo: SIGN_IN_TOKEN, who: ACCOUNT_ID });

    expect(reply.ok).toBe(true);
    const logged = JSON.stringify(r.records);
    for (const value of [SESSION_TOKEN, SIGN_IN_TOKEN, PLAYER_NAME, ACCOUNT_ID]) expect(logged).not.toContain(value);
    expect(r.records.map((record) => record['event'])).toContain('premium.worker_message');
  }, 60_000);
});
