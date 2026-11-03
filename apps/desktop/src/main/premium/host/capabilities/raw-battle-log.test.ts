import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrantedConsent } from '@bombfarm/game-api';
import type { RawBattleLogItem } from '@bombfarm/contracts';
import type { BattleLogFsPort } from '../../../game-api/battle-log-file.js';
import { CapabilityError, type CapabilityChannel } from '../capability-channel.js';
import { BATTLE_LOG_MAX_IN_FLIGHT, createRawBattleLogCapability } from './raw-battle-log.js';

const GRANTED: GrantedConsent = { decision: 'granted', grantedAt: '2026-08-12T13:15:38.000Z', textVersion: 1 };
const LOG = 'dir/battle_log.cfg';

const entries = (n: number): string => `entries=${JSON.stringify(Array.from({ length: n }, (_, i) => i))}`;

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (thrown) {
    expect(thrown).toBeInstanceOf(CapabilityError);
    return (thrown as CapabilityError).code;
  }
  return undefined;
}

function setup() {
  const files = new Map<string, { text: string; mtimeMs: number }>();
  let clock = 1_000;
  const fs: BattleLogFsPort = {
    statSync: (p) => {
      const e = files.get(p);
      if (!e) throw new Error('ENOENT');
      return { mtimeMs: e.mtimeMs, size: e.text.length };
    },
    readFileSync: (p) => {
      const e = files.get(p);
      if (!e) throw new Error('ENOENT');
      return e.text;
    },
  };
  const write = (n: number): void => {
    clock += 10;
    files.set(LOG, { text: `[acc_486]\n${entries(n)}\n`, mtimeMs: clock });
  };
  const items: RawBattleLogItem[] = [];
  const state = { paused: false, inFlight: 0 };
  const ackListeners = new Set<(seq: number) => void>();
  const channel: Pick<CapabilityChannel, 'emit' | 'inFlight' | 'onAck'> = {
    emit: ((name: string, batch: RawBattleLogItem[]) => {
      if (state.paused) return null;
      expect(name).toBe('raw.battleLog');
      items.push(...batch);
      state.inFlight += 1;
      return items.length;
    }) as CapabilityChannel['emit'],
    get inFlight() {
      return state.inFlight;
    },
    onAck: (listener) => {
      ackListeners.add(listener);
      return () => ackListeners.delete(listener);
    },
  };
  const capability = createRawBattleLogCapability({
    channel,
    tailer: {
      consent: () => GRANTED,
      licensedAccountId: () => '486',
      fs,
      battleLogPath: LOG,
      settingsPath: 'dir/settings.cfg',
      now: () => 9,
    },
  });
  const call = (op: unknown, origin: 'worker' | 'ui' = 'worker'): unknown =>
    (capability.handler as (a: unknown, c: { origin: 'worker' | 'ui' }) => unknown)({ op }, { origin });
  const ack = (): void => {
    state.inFlight -= 1;
    for (const l of [...ackListeners]) l(1);
  };
  return { capability, call, items, state, write, ack };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('raw.battleLog capability', () => {
  it('the UI origin is refused not_granted, and nothing starts', () => {
    const s = setup();
    s.write(1);
    expect(codeOf(() => s.call('subscribe', 'ui'))).toBe('not_granted');
    expect(s.capability.subscribed).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(s.items).toHaveLength(0);
  });

  it('a bad op is bad_args', () => {
    const s = setup();
    expect(codeOf(() => s.call('nope'))).toBe('bad_args');
  });

  it('subscribe sends the baseline once with seq 1, then one item per change with seq 2', () => {
    const s = setup();
    s.write(1);
    expect(s.call('subscribe')).toBeNull();
    expect(s.items).toEqual([
      {
        seq: 1,
        atMs: 9,
        accountKey: '486',
        section: 'acc_486',
        text: entries(1),
        mtimeMs: 1_010,
        gameLanguage: null,
        baseline: true,
      },
    ]);
    s.ack();
    s.write(2);
    vi.advanceTimersByTime(2_000);
    expect(s.items.map((i) => [i.seq, i.baseline])).toEqual([
      [1, true],
      [2, false],
    ]);
  });

  it('unsubscribe stops the feed; a second subscribe starts again from seq 1 with a baseline', () => {
    const s = setup();
    s.write(1);
    s.call('subscribe');
    s.call('unsubscribe');
    s.write(2);
    vi.advanceTimersByTime(10_000);
    expect(s.items).toHaveLength(1);
    s.call('subscribe');
    expect(s.items[1]).toMatchObject({ seq: 1, baseline: true, text: entries(2) });
  });

  it('paused sends nothing; resume re-baselines with the feed seq continuing', () => {
    const s = setup();
    s.write(1);
    s.call('subscribe');
    s.ack();
    s.capability.pause();
    s.write(2);
    vi.advanceTimersByTime(10_000);
    expect(s.items).toHaveLength(1);
    expect(s.capability.subscribed).toBe(true);

    s.capability.resume();
    expect(s.items).toHaveLength(2);
    expect(s.items[1]).toMatchObject({ seq: 2, baseline: true, text: entries(2) });
  });

  it('a send while the channel is paused (emit returns null) is retried, not lost', () => {
    const s = setup();
    s.write(1);
    s.state.paused = true;
    s.call('subscribe');
    vi.advanceTimersByTime(4_000);
    expect(s.items).toHaveLength(0);
    s.state.paused = false;
    vi.advanceTimersByTime(2_000);
    expect(s.items).toHaveLength(1);
    expect(s.items[0]).toMatchObject({ seq: 1, baseline: true });
  });

  it('holds the latest change while four batches are unacknowledged, and sends it on the ack', () => {
    const s = setup();
    s.state.inFlight = BATTLE_LOG_MAX_IN_FLIGHT;
    s.write(1);
    s.call('subscribe');
    vi.advanceTimersByTime(6_000);
    expect(s.items).toHaveLength(0);
    s.write(2);
    s.ack();
    expect(s.items).toHaveLength(1);
    expect(s.items[0]).toMatchObject({ seq: 1, text: entries(2), baseline: true });
  });

  it('stop ends the subscription', () => {
    const s = setup();
    s.write(1);
    s.call('subscribe');
    s.capability.stop();
    s.write(2);
    vi.advanceTimersByTime(10_000);
    expect(s.items).toHaveLength(1);
    expect(s.capability.subscribed).toBe(false);
  });
});
