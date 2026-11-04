import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPremiumTapFeedSlot } from '../../live-source/premium-tap-feed.js';
import type { KeepingSealedRows } from '../licence/licence-store.js';
import { createLogSink } from '../premium-test-support.js';
import type { LockedDb, TrackingEngine } from '../tracking/engine.js';
import { cachedSecrets, createTrackingHost, SECRETS_TTL_MS, TRACKING_PROBE_DELAY_MS } from './tracking-host.js';

describe('cachedSecrets', () => {
  it('reads once per window however often it is asked, and drops empty values', () => {
    let clock = 0;
    const read = vi.fn(() => ['tok', '', 'steam']);
    const secrets = cachedSecrets(read, () => clock);

    expect([...secrets()]).toEqual(['tok', 'steam']);
    clock += SECRETS_TTL_MS - 1;
    secrets();
    secrets();
    expect(read).toHaveBeenCalledTimes(1);

    clock += 1;
    secrets();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('picks up a changed value after the window, and never holds the old one past it', () => {
    let clock = 0;
    let token = 'first';
    const secrets = cachedSecrets(() => [token], () => clock);
    expect(secrets().has('first')).toBe(true);

    token = 'second';
    clock += SECRETS_TTL_MS;

    expect(secrets().has('second')).toBe(true);
    expect(secrets().has('first')).toBe(false);
  });

  it('re-reads when the clock goes backwards', () => {
    let clock = 100_000;
    const read = vi.fn(() => ['a']);
    const secrets = cachedSecrets(read, () => clock);
    secrets();
    clock = 5;
    secrets();
    expect(read).toHaveBeenCalledTimes(2);
  });
});

describe('the engine probe', () => {
  let root = '';
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'bfc-th-probe-'));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(async () => {
    vi.useRealTimers();
    await rm(root, { recursive: true, force: true });
  });

  function build(extra: { timedProbe?: boolean } = {}) {
    const probe = vi.fn(() => Promise.resolve({ ok: true, version: 'v' } as const));
    const open = vi.fn(async (file: string) => {
      if (!existsSync(file)) await writeFile(file, 'x');
      return { run: () => Promise.resolve(), query: () => Promise.resolve([]), session: () => Promise.reject(new Error('n/a')), close: () => undefined } satisfies LockedDb;
    });
    const engine: TrackingEngine = { probe, open };
    const rows: KeepingSealedRows = {
      available: () => true,
      read: () => null,
      readKept: () => ({ ok: false, reason: 'absent' }),
      write: () => 'written',
      delete: () => true,
    };
    const host = createTrackingHost({
      root,
      rows,
      extensionPath: 'unused',
      engine,
      feedSlot: createPremiumTapFeedSlot(),
      subject: () => 'subject-1',
      playingAccountAllows: () => true,
      accountKey: () => '486',
      secrets: () => new Set(),
      battleLog: { source: { stat: () => null, read: () => null, gameLanguage: () => null } },
      log: createLogSink(),
      now: () => 0,
      mono: () => 0,
      ...extra,
    });
    return { host, probe };
  }

  it('does not run when the host is built, nor when Settings asks for the history', () => {
    const { host, probe } = build();

    expect(host.history('subject-1')).toEqual({ state: 'none' });
    expect(probe).not.toHaveBeenCalled();
  });

  it('runs once, about 5 seconds after it is armed, however often it is armed', async () => {
    const { host, probe } = build();

    host.armProbe();
    host.armProbe();
    await vi.advanceTimersByTimeAsync(TRACKING_PROBE_DELAY_MS - 1);
    expect(probe).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(probe).toHaveBeenCalledTimes(1);

    host.dispose();
  });

  it('stays unarmed when the timed probe is off, and still runs on the first db call', async () => {
    const { host, probe } = build({ timedProbe: false });

    host.armProbe();
    await vi.advanceTimersByTimeAsync(TRACKING_PROBE_DELAY_MS * 2);
    expect(probe).not.toHaveBeenCalled();

    await host.handlers.db({ op: 'status' });
    expect(probe).toHaveBeenCalledTimes(1);

    host.dispose();
  });

  it('does not run again when the handle is closed and the next call reopens it', async () => {
    const { host, probe } = build();
    host.armProbe();
    await vi.advanceTimersByTimeAsync(TRACKING_PROBE_DELAY_MS);

    await host.handlers.db({ op: 'status' });
    await host.close();
    await host.handlers.db({ op: 'status' });

    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('runs on the first db call when nobody armed it, so a db call never waits for a timer', async () => {
    const { host, probe } = build();

    await host.handlers.db({ op: 'status' });

    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('is cancelled by dispose', async () => {
    const { host, probe } = build();
    host.armProbe();
    host.dispose();

    await vi.advanceTimersByTimeAsync(TRACKING_PROBE_DELAY_MS * 2);

    expect(probe).not.toHaveBeenCalled();
  });
});
