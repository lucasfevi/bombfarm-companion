import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LiveGapReason } from '@bombfarm/contracts';
import { en } from '../../lib/copy/en';
import { NeverReadEmptyState } from './never-read-empty-state';
import type { ReachedLiveFreshness } from './freshness-line';

// `useCopy()` is a hook, so it needs an active React dispatcher — fine for the
// `renderToStaticMarkup` calls below, but not for calling `NeverReadEmptyState` directly as a
// plain function the way the reopen-consent wiring test at the bottom does. Mocking it the same
// way `diagnostics-section-wiring.test.tsx` does covers both.
vi.mock('../../lib/copy', () => ({
  useCopy: () => en,
  LIVE_GAP_REASON_COPY_KEY: {
    clientNotStreaming: 'liveGapReasonClientNotStreaming',
    neverAttached: 'liveGapReasonNeverAttached',
    consentMissing: 'liveGapReasonConsentMissing',
    runtimeUnavailable: 'liveGapReasonRuntimeUnavailable',
    attachFailed: 'liveGapReasonAttachFailed',
    detached: 'liveGapReasonDetached',
    hookSilent: 'liveGapReasonHookSilent',
  },
}));

const GAP_REASONS: readonly LiveGapReason[] = [
  'clientNotStreaming',
  'neverAttached',
  'consentMissing',
  'runtimeUnavailable',
  'attachFailed',
  'detached',
  'hookSilent',
];

const GAP_COPY: Record<LiveGapReason, string> = {
  clientNotStreaming: en.liveGapReasonClientNotStreaming,
  neverAttached: en.liveGapReasonNeverAttached,
  consentMissing: en.liveGapReasonConsentMissing,
  runtimeUnavailable: en.liveGapReasonRuntimeUnavailable,
  attachFailed: en.liveGapReasonAttachFailed,
  detached: en.liveGapReasonDetached,
  hookSilent: en.liveGapReasonHookSilent,
};

// What used to render unconditionally before this fix — asserted absent below rather than
// pulled from the copy layer, since the key it lived under no longer exists.
const OLD_OPEN_THE_GAME_INSTRUCTION = 'Open the game with the companion running';

function html(freshness: ReachedLiveFreshness) {
  return renderToStaticMarkup(createElement(NeverReadEmptyState, { freshness }));
}

describe('NeverReadEmptyState — every gap reason states what is actually happening', () => {
  it.each(GAP_REASONS)('%s renders that reason’s own copy, never the old instruction', (reason) => {
    const out = html({ kind: 'gap', reason, actionable: reason === 'consentMissing', sinceAt: 't' });
    expect(out).toContain(GAP_COPY[reason]);
    expect(out).not.toContain(OLD_OPEN_THE_GAME_INSTRUCTION);
  });

  it('still says security software for runtimeUnavailable when likelyQuarantine is set', () => {
    const out = html({ kind: 'gap', reason: 'runtimeUnavailable', actionable: false, sinceAt: 't', likelyQuarantine: true });
    expect(out).toContain(en.liveGapReasonRuntimeUnavailableQuarantine);
  });
});

describe('NeverReadEmptyState — live but nothing read from the account yet', () => {
  it('renders the reading-now description, not a gap reason and not the old instruction', () => {
    const out = html({ kind: 'live' });
    expect(out).toContain(en.liveNeverReadAccountPendingDescription);
    expect(out).not.toContain(OLD_OPEN_THE_GAME_INSTRUCTION);
  });
});

describe('NeverReadEmptyState — the reopen-consent control', () => {
  it('offers no control for a gap the app is already retrying on its own', () => {
    const out = html({ kind: 'gap', reason: 'detached', actionable: true, sinceAt: 't' });
    expect(out).not.toContain('data-testid="live-never-read-reopen-consent"');
  });

  it('offers no control for consentMissing when no callback is supplied', () => {
    const out = html({ kind: 'gap', reason: 'consentMissing', actionable: true, sinceAt: 't' });
    expect(out).not.toContain('data-testid="live-never-read-reopen-consent"');
  });

  it('renders the control for consentMissing and wires it to the supplied callback', () => {
    const onReopenConsent = vi.fn();
    const root = NeverReadEmptyState({
      freshness: { kind: 'gap', reason: 'consentMissing', actionable: true, sinceAt: 't' },
      onReopenConsent,
    }) as unknown as {
      props: { action?: { props: { onClick: () => void; 'data-testid': string } } };
    };

    const button = root.props.action;
    expect(button?.props['data-testid']).toBe('live-never-read-reopen-consent');
    button?.props.onClick();
    expect(onReopenConsent).toHaveBeenCalledTimes(1);
  });
});

describe('NeverReadEmptyState — the waiting cue', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('animates for a gap reason the app is retrying on its own', () => {
    const out = html({ kind: 'gap', reason: 'detached', actionable: true, sinceAt: 't' });
    expect(out).toContain('animate-pulse');
  });

  it('animates while reading the account for the first time', () => {
    const out = html({ kind: 'live' });
    expect(out).toContain('animate-pulse');
  });

  it('is absent while consent is missing — nothing is actually in progress there', () => {
    const out = html({ kind: 'gap', reason: 'consentMissing', actionable: true, sinceAt: 't' });
    expect(out).not.toContain('bg-accent');
    expect(out).not.toContain('animate-pulse');
  });

  it('renders the static form, not absent and not animating, when reduced motion is set', () => {
    (globalThis as unknown as { window: { matchMedia: (query: string) => { matches: boolean } } }).window = {
      matchMedia: () => ({ matches: true }),
    };
    const out = html({ kind: 'gap', reason: 'detached', actionable: true, sinceAt: 't' });
    expect(out).toContain('bg-accent');
    expect(out).not.toContain('animate-pulse');
  });
});
