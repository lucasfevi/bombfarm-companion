import { describe, expect, it } from 'vitest';
import { isIpcChannel, isIpcEventChannel, IPC_CHANNELS, IPC_EVENT_CHANNELS } from './index.js';
import { isActionableGap, liveGap, LIVE_DISPLAY_REFRESH_MS, type LiveEvent, type LiveGapReason } from './live-source.js';

/** Exhaustive over `LiveGapReason` via a `satisfies` record: adding a reason without adding it
 *  here is a compile error, not a silently-actionable gap. */
const EXPECTED_ACTIONABLE = {
  clientNotStreaming: false,
  neverAttached: true,
  consentMissing: true,
  runtimeUnavailable: true,
  attachFailed: true,
  detached: true,
  hookSilent: true,
} satisfies Record<LiveGapReason, boolean>;

const ALL_REASONS = Object.keys(EXPECTED_ACTIONABLE) as readonly LiveGapReason[];

describe('isActionableGap', () => {
  it('is false only for clientNotStreaming', () => {
    for (const reason of ALL_REASONS) {
      expect(isActionableGap(reason)).toBe(EXPECTED_ACTIONABLE[reason]);
    }
  });
});

describe('liveGap', () => {
  it('derives actionable from isActionableGap for every reason', () => {
    const sinceAt = '2026-08-22T00:00:00.000Z';
    for (const reason of ALL_REASONS) {
      const gap = liveGap(reason, sinceAt);
      expect(gap.kind).toBe('gap');
      if (gap.kind !== 'gap') {
        throw new Error('liveGap must always return the gap variant');
      }
      expect(gap.reason).toBe(reason);
      expect(gap.actionable).toBe(isActionableGap(reason));
      expect(gap.sinceAt).toBe(sinceAt);
    }
  });

  it('carries likelyQuarantine through for runtimeUnavailable', () => {
    const sinceAt = '2026-08-22T00:00:00.000Z';
    const gap = liveGap('runtimeUnavailable', sinceAt, { likelyQuarantine: true });
    expect(gap.kind).toBe('gap');
    if (gap.kind === 'gap') {
      expect(gap.likelyQuarantine).toBe(true);
    }
  });

  it('leaves likelyQuarantine undefined when not passed', () => {
    const sinceAt = '2026-08-22T00:00:00.000Z';
    const gap = liveGap('attachFailed', sinceAt);
    expect(gap.kind).toBe('gap');
    if (gap.kind === 'gap') {
      expect(gap.likelyQuarantine).toBeUndefined();
    }
  });
});

describe('live IPC surface', () => {
  it('registers live:get as an invoke channel', () => {
    expect(isIpcChannel('live:get')).toBe(true);
    expect(IPC_CHANNELS).toContain('live:get');
  });

  it('registers live:event as an event channel', () => {
    expect(isIpcEventChannel('live:event')).toBe(true);
    expect(IPC_EVENT_CHANNELS).toContain('live:event');
  });

  it('registers live:dumpDiagnostics as an invoke channel', () => {
    expect(isIpcChannel('live:dumpDiagnostics')).toBe(true);
    expect(IPC_CHANNELS).toContain('live:dumpDiagnostics');
  });

  it('keeps the pre-existing channels the live seam does not retire', () => {
    expect(isIpcChannel('consent:get')).toBe(true);
    expect(isIpcChannel('consent:accept')).toBe(true);
    expect(isIpcChannel('consent:decline')).toBe(true);
    expect(isIpcChannel('consent:revoke')).toBe(true);
  });
});

describe('LIVE_DISPLAY_REFRESH_MS', () => {
  it('is the one constant both the main process and the renderer pace the fast channel to', () => {
    expect(LIVE_DISPLAY_REFRESH_MS).toBe(250);
  });
});

describe('LiveEvent — the fastUpdate variant', () => {
  it('carries field, recovery, the live on-field id set, and earnings, and nothing else', () => {
    const event: LiveEvent = { type: 'fastUpdate', field: [], recovery: [], onFieldHeroIds: [], earnings: null };
    expect(Object.keys(event).sort()).toEqual(['earnings', 'field', 'onFieldHeroIds', 'recovery', 'type']);
  });
});
