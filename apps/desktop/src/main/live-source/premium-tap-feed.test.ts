import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RawGapItem, RawTapItem } from '@bombfarm/contracts';
import type { ObservationCapture, ObservationSink } from './observation-capture.js';
import {
  createPremiumTapFeed,
  createPremiumTapFeedSlot,
  fanOutObservers,
  TAP_RING_ITEMS,
  type PremiumTapFeed,
} from './premium-tap-feed.js';

const SESSION = 'sess-token-AAAA1111';
const SIGN_IN = 'signin-token-BBBB2222';
const STEAM = '76561198000000042';

interface Posted {
  readonly seq: number;
  readonly name: string;
  readonly items: readonly unknown[];
}

class FakeChannel {
  readonly posted: Posted[] = [];
  private acks = new Set<(seq: number) => void>();
  private unacked = new Set<number>();
  private next = 1;
  closed = false;

  get inFlight(): number {
    return this.unacked.size;
  }

  emit(name: string, items: readonly unknown[]): number | null {
    if (this.closed) return null;
    const seq = this.next++;
    this.unacked.add(seq);
    this.posted.push({ seq, name, items });
    return seq;
  }

  onAck(listener: (seq: number) => void): () => void {
    this.acks.add(listener);
    return () => {
      this.acks.delete(listener);
    };
  }

  ack(seq: number): void {
    this.unacked.delete(seq);
    for (const listener of [...this.acks]) listener(seq);
  }

  ackAll(): void {
    for (const seq of [...this.unacked]) this.ack(seq);
  }

  tapItems(): RawTapItem[] {
    return this.posted.filter((p) => p.name === 'raw.tap').flatMap((p) => p.items as RawTapItem[]);
  }
}

interface Rig {
  readonly channel: FakeChannel;
  readonly feed: PremiumTapFeed;
  readonly state: { allows: boolean; key: string | null };
  readonly logs: Record<string, unknown>[];
}

function rig(secrets: string[] = [SESSION, SIGN_IN, STEAM]): Rig {
  const channel = new FakeChannel();
  const state = { allows: true, key: '486' as string | null };
  const logs: Record<string, unknown>[] = [];
  const feed = createPremiumTapFeed({
    channel,
    playingAccountAllows: () => state.allows,
    accountKey: () => state.key,
    secrets: () => new Set(secrets),
    log: { info: () => undefined, warn: (r) => logs.push(r), error: () => undefined },
    now: () => Date.now(),
  });
  return { channel, feed, state, logs };
}

const body = (value: unknown): Buffer => Buffer.from(JSON.stringify(value), 'utf8');

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('delivery', () => {
  it('delivers frames and JSON bodies in arrival order, with seq from 1 and the account key', () => {
    const { channel, feed } = rig();
    feed.subscribe();
    feed.frame({ a: 1 }, 10);
    feed.body(body({ b: 2 }), 11);
    feed.frame({ c: 3 }, 12);
    vi.advanceTimersByTime(100);
    expect(channel.tapItems()).toEqual([
      { kind: 'frame', seq: 1, atMs: 10, accountKey: '486', wire: { a: 1 } },
      { kind: 'body', seq: 2, atMs: 11, accountKey: '486', body: { b: 2 } },
      { kind: 'frame', seq: 3, atMs: 12, accountKey: '486', wire: { c: 3 } },
    ]);
  });

  it('does not deliver a body that is not JSON, and does not spend a seq on it', () => {
    const { channel, feed } = rig();
    feed.subscribe();
    feed.body(Buffer.from('<html>not json</html>'), 1);
    feed.frame({ a: 1 }, 2);
    vi.advanceTimersByTime(100);
    expect(channel.tapItems().map((i) => [i.kind, i.seq])).toEqual([['frame', 1]]);
  });

  it('sends nothing before the 100 ms window closes, then one batch', () => {
    const { channel, feed } = rig();
    feed.subscribe();
    feed.frame({ a: 1 }, 1);
    vi.advanceTimersByTime(99);
    expect(channel.posted).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(channel.posted).toHaveLength(1);
  });

  it('flushes at 256 items without waiting for the timer', () => {
    const { channel, feed } = rig();
    feed.subscribe();
    for (let i = 0; i < 256; i++) feed.frame({ i }, i);
    expect(channel.posted).toHaveLength(1);
    expect(channel.posted[0]?.items).toHaveLength(256);
  });
});

describe('the per-event gate', () => {
  it('delivers nothing before subscribe or after unsubscribe', () => {
    const { channel, feed } = rig();
    feed.frame({ a: 1 }, 1);
    feed.subscribe();
    feed.unsubscribe();
    feed.frame({ a: 2 }, 2);
    vi.advanceTimersByTime(500);
    expect(channel.posted).toHaveLength(0);
  });

  it('delivers nothing with no game account, or with another account playing', () => {
    const { channel, feed, state } = rig();
    feed.subscribe();
    state.key = null;
    feed.frame({ a: 1 }, 1);
    state.key = '486';
    state.allows = false;
    feed.frame({ a: 2 }, 2);
    feed.body(body({ a: 3 }), 3);
    vi.advanceTimersByTime(500);
    expect(channel.posted).toHaveLength(0);
  });

  it('delivers nothing while paused, keeps nothing, replays nothing on resume, and seq continues', () => {
    const { channel, feed } = rig();
    feed.subscribe();
    feed.frame({ a: 1 }, 1);
    vi.advanceTimersByTime(100);
    feed.frame({ queued: true }, 2);
    feed.pause();
    feed.frame({ during: true }, 3);
    vi.advanceTimersByTime(500);
    feed.resume();
    vi.advanceTimersByTime(500);
    expect(channel.tapItems()).toHaveLength(1);
    feed.frame({ after: true }, 4);
    vi.advanceTimersByTime(100);
    expect(channel.tapItems().map((i) => [i.seq, i.kind === 'frame' ? i.wire : null])).toEqual([
      [1, { a: 1 }],
      [2, { after: true }],
    ]);
  });

  it('keeps seq gap-free when a post is refused: the lost batch is not skipped', () => {
    const { channel, feed } = rig();
    feed.subscribe();
    feed.frame({ a: 1 }, 1);
    vi.advanceTimersByTime(100);
    feed.frame({ lost: true }, 2);
    channel.closed = true;
    vi.advanceTimersByTime(100);
    channel.closed = false;
    feed.frame({ next: true }, 3);
    vi.advanceTimersByTime(100);
    expect(channel.posted.filter((p) => p.name === 'raw.gap')).toHaveLength(0);
    expect(channel.tapItems().map((i) => i.seq)).toEqual([1, 2]);
    expect(channel.tapItems()[1]).toMatchObject({ wire: { next: true } });
  });

  it('keeps seq gap-free when the gap post itself is refused', () => {
    const { channel, feed } = rig();
    feed.subscribe();
    for (let i = 0; i < 1024; i++) feed.frame({ i }, 0);
    for (let i = 0; i < TAP_RING_ITEMS + 5; i++) feed.frame({ i }, 0);
    channel.closed = true;
    channel.ack(1);
    channel.ack(2);
    channel.closed = false;
    feed.frame({ next: true }, 0);
    channel.ackAll();
    vi.advanceTimersByTime(100);
    expect(channel.posted.filter((p) => p.name === 'raw.gap')).toHaveLength(0);
    expect(channel.tapItems().map((i) => i.seq)).toEqual([...Array.from({ length: 1024 }, (_, k) => k + 1), 1025]);
  });

  it('starts seq at 1 again on a new subscription', () => {
    const { channel, feed } = rig();
    feed.subscribe();
    feed.frame({ a: 1 }, 1);
    vi.advanceTimersByTime(100);
    feed.unsubscribe();
    feed.subscribe();
    feed.frame({ a: 2 }, 2);
    vi.advanceTimersByTime(100);
    expect(channel.tapItems().map((i) => i.seq)).toEqual([1, 1]);
  });

  it('delivers nothing once the channel has refused a post (paused or closed), and clears what it held', () => {
    const { channel, feed } = rig();
    feed.subscribe();
    feed.frame({ a: 1 }, 1);
    channel.closed = true;
    vi.advanceTimersByTime(100);
    channel.closed = false;
    vi.advanceTimersByTime(500);
    expect(channel.posted).toHaveLength(0);
  });
});

describe('backpressure and the ring', () => {
  it('keeps at most 4 batches unacked and resumes sending on an ack', () => {
    const { channel, feed } = rig();
    feed.subscribe();
    for (let b = 0; b < 6; b++) {
      for (let i = 0; i < 256; i++) feed.frame({ b, i }, 0);
    }
    expect(channel.posted).toHaveLength(4);
    expect(channel.inFlight).toBe(4);
    channel.ack(1);
    expect(channel.posted).toHaveLength(5);
    expect(channel.inFlight).toBe(4);
  });

  it('drops the oldest past 2,000 items and precedes the next batch with one matching raw.gap', () => {
    const { channel, feed } = rig();
    feed.subscribe();
    // Four full batches in flight (seq 1..1024), nothing acked.
    for (let i = 0; i < 1024; i++) feed.frame({ i }, 0);
    expect(channel.inFlight).toBe(4);
    const extra = TAP_RING_ITEMS + 50;
    for (let i = 0; i < extra; i++) feed.frame({ extra: i }, 0);
    expect(channel.posted).toHaveLength(4);
    channel.ack(1);
    channel.ack(2);
    const gaps = channel.posted.filter((p) => p.name === 'raw.gap');
    expect(gaps).toHaveLength(1);
    const gap = gaps[0]?.items[0] as RawGapItem;
    // The ring holds the newest 2,000 of the 2,050 queued: the first 50 (seq 1025..1074) were dropped.
    expect(gap).toEqual({ feed: 'raw.tap', dropped: 50, fromSeq: 1025 });
    const idx = channel.posted.findIndex((p) => p.name === 'raw.gap');
    expect(channel.posted[idx + 1]?.name).toBe('raw.tap');
    expect((channel.posted[idx + 1]?.items[0] as RawTapItem).seq).toBe(1075);
    expect(channel.inFlight).toBeLessThanOrEqual(4);
  });

  it('drops by bytes as well as by count', () => {
    const { channel, feed } = rig();
    feed.subscribe();
    for (let i = 0; i < 1024; i++) feed.frame({ i }, 0);
    const big = 'x'.repeat(2 * 1024 * 1024);
    for (let i = 0; i < 6; i++) feed.frame({ big }, 0);
    channel.ackAll();
    const gap = channel.posted.find((p) => p.name === 'raw.gap')?.items[0] as RawGapItem;
    expect(gap.dropped).toBeGreaterThan(0);
    expect(gap.fromSeq).toBe(1025);
  });

  it('never awaits: with every slot taken the tap calls complete synchronously and post nothing more', () => {
    const { channel, feed } = rig();
    feed.subscribe();
    for (let i = 0; i < 1024; i++) feed.frame({ i }, 0);
    feed.frame({ more: true }, 0);
    feed.body(body({ more: true }), 0);
    expect(channel.posted).toHaveLength(4);
  });
});

describe('credentials never reach an item', () => {
  it('removes credential keys and any value holding the session token, sign-in token or SteamID', () => {
    const { channel, feed } = rig();
    feed.subscribe();
    feed.frame(
      {
        ok: 1,
        accessToken: 'x',
        carried: `Bearer ${SESSION}`,
        nested: { signin: SIGN_IN, steam: STEAM, keep: 'fine' },
        list: ['a', STEAM, 'b'],
      },
      1,
    );
    feed.body(body({ ok: 2, who: STEAM, deep: [{ t: SESSION, k: 1 }] }), 2);
    vi.advanceTimersByTime(100);
    const text = JSON.stringify(channel.posted);
    for (const secret of [SESSION, SIGN_IN, STEAM, 'accessToken']) expect(text).not.toContain(secret);
    expect(channel.tapItems()[0]).toMatchObject({ wire: { ok: 1, nested: { keep: 'fine' }, list: ['a', 'b'] } });
  });

  it('withholds an item whose SteamID survives as a key name, without spending a seq', () => {
    const { channel, feed } = rig();
    feed.subscribe();
    feed.frame({ [STEAM]: 1 }, 1);
    feed.body(body({ [STEAM]: 1 }), 2);
    feed.frame({ fine: true }, 3);
    vi.advanceTimersByTime(100);
    expect(JSON.stringify(channel.posted)).not.toContain(STEAM);
    expect(channel.tapItems()).toEqual([{ kind: 'frame', seq: 1, atMs: 3, accountKey: '486', wire: { fine: true } }]);
  });

  it('keeps the game account id and player name', () => {
    const { channel, feed } = rig();
    feed.subscribe();
    feed.frame({ account_id: '486', player_name: 'Ana' }, 1);
    vi.advanceTimersByTime(100);
    expect(channel.tapItems()[0]).toMatchObject({ wire: { account_id: '486', player_name: 'Ana' } });
  });
});

describe('a feed that fails', () => {
  it('never throws out of a tap call and reports a deduped record', () => {
    const channel = new FakeChannel();
    const logs: Record<string, unknown>[] = [];
    const feed = createPremiumTapFeed({
      channel,
      playingAccountAllows: () => {
        throw new Error('boom');
      },
      accountKey: () => '486',
      secrets: () => new Set(),
      log: { info: () => undefined, warn: (r) => logs.push(r), error: () => undefined },
      now: () => Date.now(),
    });
    feed.subscribe();
    expect(() => {
      feed.frame({ a: 1 }, 1);
      feed.body(body({ a: 1 }), 2);
    }).not.toThrow();
    expect(logs.length).toBeGreaterThan(0);
  });

  it('stops listening to acks after dispose', () => {
    const { channel, feed } = rig();
    feed.subscribe();
    for (let i = 0; i < 1100; i++) feed.frame({ i }, 0);
    feed.dispose();
    const before = channel.posted.length;
    channel.ackAll();
    expect(channel.posted).toHaveLength(before);
  });
});

describe('fanOutObservers', () => {
  const setRedactor = vi.fn();
  const closeCapture = vi.fn();
  function capture(): ObservationCapture & { frames: number; throwing: boolean } {
    const c = {
      frames: 0,
      throwing: false,
      body: () => undefined,
      frame: () => {
        c.frames += 1;
        if (c.throwing) throw new Error('capture fault');
      },
      currency: () => undefined,
      mark: () => undefined,
      setCredentialRedactor: setRedactor,
      close: closeCapture,
    };
    return c;
  }

  it('keeps feeding both sinks after the premium feed throws', () => {
    const primary = capture();
    let secondaryFrames = 0;
    const secondary: ObservationSink = {
      ...createPremiumTapFeedSlot().sink,
      frame: () => {
        secondaryFrames += 1;
        throw new Error('feed fault');
      },
    };
    const fan = fanOutObservers(primary, secondary);
    expect(() => {
      fan.frame({ a: 1 }, 1);
      fan.frame({ a: 2 }, 2);
    }).not.toThrow();
    expect(primary.frames).toBe(2);
    expect(secondaryFrames).toBe(2);
  });

  it('still reaches the premium feed when the developer capture throws', () => {
    const primary = capture();
    primary.throwing = true;
    const { channel, feed } = rig();
    feed.subscribe();
    const fan = fanOutObservers(primary, feed);
    expect(() => {
      fan.frame({ a: 1 }, 1);
    }).not.toThrow();
    vi.advanceTimersByTime(100);
    expect(channel.tapItems()).toHaveLength(1);
  });

  it('forwards the redactor and close to the developer capture only', () => {
    const primary = capture();
    const fan = fanOutObservers(primary, createPremiumTapFeedSlot().sink);
    fan.setCredentialRedactor(null);
    fan.close();
    expect(setRedactor).toHaveBeenCalledWith(null);
    expect(closeCapture).toHaveBeenCalledTimes(1);
  });
});

describe('the feed slot', () => {
  it('is a no-op until a feed is set, then forwards, then no-ops again when cleared', () => {
    const slot = createPremiumTapFeedSlot();
    const { channel, feed } = rig();
    feed.subscribe();
    slot.sink.frame({ a: 1 }, 1);
    slot.set(feed);
    slot.sink.frame({ a: 2 }, 2);
    slot.set(null);
    slot.sink.frame({ a: 3 }, 3);
    vi.advanceTimersByTime(100);
    expect(channel.tapItems().map((i) => (i.kind === 'frame' ? i.wire : null))).toEqual([{ a: 2 }]);
  });
});
