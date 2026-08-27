import { resolve } from 'node:path';
import type { LiveEvent } from '@bombfarm/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createReplayTapFactory,
  isReplayLiveSourceEnabled,
  REPLAY_FRAME_INTERVAL_MS,
  resolveReplayCapturePath,
} from './replay-tap.js';

/** `__dirname`, not `import.meta.url`: `tsconfig.main.json` builds this tree to CommonJS. */
const HERE = __dirname;
const COMMITTED_CAPTURE = resolve(HERE, 'fixtures', 'live-capture.bfcc');

/** The committed capture holds 60 records that decode to 58 ticks — see `live-capture.test.ts`. */
const CAPTURE_RECORDS = 60;
const CAPTURE_TICKS = 58;

function drive(overrides: { readonly consent?: () => boolean; readonly capturePath?: string } = {}) {
  const events: LiveEvent[] = [];
  const handle = createReplayTapFactory({
    capturePath: overrides.capturePath ?? COMMITTED_CAPTURE,
    consent: overrides.consent ?? (() => true),
  })(
    (event) => events.push(event),
    () => undefined,
  );
  const frames = () => events.filter((event) => event.type === 'frame');
  const currencies = () => events.filter((event) => event.type === 'currency');
  return { events, handle, frames, currencies };
}

function advanceRecords(count: number): void {
  vi.advanceTimersByTime(REPLAY_FRAME_INTERVAL_MS * count);
}

describe('isReplayLiveSourceEnabled', () => {
  it('is on only for the replay token in an unpackaged build', () => {
    expect(isReplayLiveSourceEnabled({ BFC_LIVE_SOURCE: 'replay' }, false)).toBe(true);
    expect(isReplayLiveSourceEnabled({ BFC_LIVE_SOURCE: 'live' }, false)).toBe(false);
    expect(isReplayLiveSourceEnabled({}, false)).toBe(false);
  });

  it('is off in a packaged build no matter what the environment says', () => {
    expect(isReplayLiveSourceEnabled({ BFC_LIVE_SOURCE: 'replay' }, true)).toBe(false);
  });
});

describe('resolveReplayCapturePath', () => {
  it('prefers an explicit override', () => {
    expect(resolveReplayCapturePath({ BFC_REPLAY_CAPTURE: 'C:\\tmp\\other.bfcc' }, HERE)).toBe(
      'C:\\tmp\\other.bfcc',
    );
  });

  it('ignores an empty override rather than resolving to nothing', () => {
    expect(resolveReplayCapturePath({ BFC_REPLAY_CAPTURE: '' }, HERE)).not.toBe('');
  });

  it('names a path even when no candidate exists, so a missing capture is reportable', () => {
    const resolved = resolveReplayCapturePath({}, resolve(HERE, 'nowhere', 'at', 'all'));
    expect(resolved.endsWith('live-capture.bfcc')).toBe(true);
  });
});

describe('the replay tap drives the real decode path from the committed capture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits one frame per decoded tick, in sequence, without attaching to anything', async () => {
    const { handle, frames } = drive();
    handle.start();
    advanceRecords(CAPTURE_RECORDS);

    const emitted = frames();
    expect(emitted.length).toBe(CAPTURE_TICKS);
    expect(emitted.map((event) => event.frame.sequence)).toEqual(
      Array.from({ length: CAPTURE_TICKS }, (_, index) => index + 1),
    );
    await handle.teardown();
  });

  it('reports live currency once the first tick decodes, having started from a gap', async () => {
    const { handle, currencies } = drive();
    handle.start();
    const atStart = currencies();
    expect(atStart.length).toBe(1);
    expect(atStart[0]?.currency.kind).toBe('gap');

    advanceRecords(CAPTURE_RECORDS);
    const live = currencies().filter((event) => event.currency.kind === 'live');
    expect(live.length).toBe(1);
    await handle.teardown();
  });

  it('loops, so the stream does not simply die after one pass of the capture', async () => {
    const { handle, frames } = drive();
    handle.start();
    advanceRecords(CAPTURE_RECORDS * 2);
    expect(frames().length).toBeGreaterThan(CAPTURE_TICKS);
    await handle.teardown();
  });

  /**
   * Gold on the wire is an account total. Replayed from the top it would drop by a pass's whole
   * takings every few seconds, and a rate read across that seam is negative — which is exactly
   * what a gold-per-hour readout would do with it.
   */
  it('never lets gold go backwards, across several passes of the capture', async () => {
    const { handle, frames } = drive();
    handle.start();
    advanceRecords(CAPTURE_RECORDS * 3);

    const gold = frames()
      .map((event) => event.frame.tick.gold)
      .filter((value): value is number => value !== undefined);
    expect(gold.length).toBeGreaterThan(CAPTURE_TICKS * 2);

    const drops = gold.filter((value, index) => index > 0 && value < (gold[index - 1] as number));
    expect(drops).toEqual([]);
    await handle.teardown();
  });

  it('carries each completed pass forward, so three passes gain three passes worth', async () => {
    const { handle, frames } = drive();
    handle.start();
    advanceRecords(CAPTURE_RECORDS);
    const afterOne = frames();
    const firstGold = afterOne[0]?.frame.tick.gold as number;
    const onePassGain = (afterOne[afterOne.length - 1]?.frame.tick.gold as number) - firstGold;
    expect(onePassGain).toBeGreaterThan(0);

    advanceRecords(CAPTURE_RECORDS * 2);
    const all = frames();
    const totalGain = (all[all.length - 1]?.frame.tick.gold as number) - firstGold;

    // Three passes of the same recording, so about three times one pass's takings — within a
    // pass, since a pass boundary can land mid-tick.
    expect(totalGain).toBeGreaterThan(onePassGain * 2);
    expect(totalGain).toBeLessThanOrEqual(onePassGain * 3);
    await handle.teardown();
  });

  /**
   * `LiveSource.forceDetach()` discards the tap and builds another through the same factory, which
   * is what a consent revoke does. Every other case here drives ONE handle, so none of them would
   * notice a balance that resets on replacement — the earlier per-instance carry passed all of
   * them while dropping the whole session's gold on the first revoke.
   */
  it('keeps the balance climbing across a tap rebuilt from the same factory', async () => {
    const events: LiveEvent[] = [];
    const factory = createReplayTapFactory({
      capturePath: COMMITTED_CAPTURE,
      consent: () => true,
    });
    const goldFrom = (list: readonly LiveEvent[]): number[] =>
      list
        .filter((event) => event.type === 'frame')
        .map((event) => event.frame.tick.gold)
        .filter((value): value is number => value !== undefined);

    const first = factory(
      (event) => events.push(event),
      () => undefined,
    );
    first.start();
    advanceRecords(CAPTURE_RECORDS + 20);
    const beforeRebuild = goldFrom(events);
    const highWater = beforeRebuild[beforeRebuild.length - 1] as number;
    expect(highWater).toBeGreaterThan(beforeRebuild[0] as number);
    await first.teardown();

    const second = factory(
      (event) => events.push(event),
      () => undefined,
    );
    second.start();
    advanceRecords(20);
    const afterRebuild = goldFrom(events).slice(beforeRebuild.length);

    expect(afterRebuild.length).toBeGreaterThan(0);
    expect(Math.min(...afterRebuild)).toBeGreaterThanOrEqual(highWater);
    await second.teardown();
  });

  it('emits nothing while consent is withheld, and says why', async () => {
    const { handle, frames, currencies } = drive({ consent: () => false });
    handle.start();
    advanceRecords(CAPTURE_RECORDS);

    expect(frames().length).toBe(0);
    const reasons = currencies().map((event) =>
      event.currency.kind === 'gap' ? event.currency.reason : null,
    );
    expect(reasons).toContain('consentMissing');
    await handle.teardown();
  });

  it('stops emitting the moment consent is revoked mid-replay', async () => {
    let granted = true;
    const { handle, frames } = drive({ consent: () => granted });
    handle.start();
    advanceRecords(10);
    const beforeRevoke = frames().length;
    expect(beforeRevoke).toBeGreaterThan(0);

    granted = false;
    advanceRecords(CAPTURE_RECORDS);
    expect(frames().length).toBe(beforeRevoke);
    await handle.teardown();
  });

  it('reports an attach failure instead of throwing when the capture is not there', async () => {
    const { handle, frames, currencies } = drive({
      capturePath: resolve(HERE, 'fixtures', 'does-not-exist.bfcc'),
    });
    handle.start();
    advanceRecords(CAPTURE_RECORDS);

    expect(frames().length).toBe(0);
    const reasons = currencies().map((event) =>
      event.currency.kind === 'gap' ? event.currency.reason : null,
    );
    expect(reasons).toContain('attachFailed');
    await handle.teardown();
  });

  it('stops emitting after teardown', async () => {
    const { handle, frames } = drive();
    handle.start();
    advanceRecords(5);
    const beforeTeardown = frames().length;
    await handle.teardown();

    advanceRecords(CAPTURE_RECORDS);
    expect(frames().length).toBe(beforeTeardown);
  });
});
