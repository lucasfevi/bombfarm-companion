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
