// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { en } from '../../lib/copy/en';
import { NeverReadEmptyState } from './never-read-empty-state';
import { HERO6_MENU_IDLE_FRAME_MS, HERO6_MENU_IDLE_FRAMES } from './hero6-menu-idle';
import type { ReachedLiveFreshness } from './freshness-line';

// react-dom/client warns that act() is unsupported unless this is set — normally a testing
// harness does it for you; there is none here, so it's set by hand (matches sprite-loop.test.tsx).
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

function currentSrc(container: HTMLDivElement): string | null {
  return container.querySelector('img')?.getAttribute('src') ?? null;
}

describe('NeverReadEmptyState — the waiting sprite animates only when something is pending', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
      root = createRoot(container);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  function render(freshness: ReachedLiveFreshness) {
    act(() => {
      root.render(createElement(NeverReadEmptyState, { freshness }));
    });
  }

  it('advances frames for a gap reason the app is retrying on its own', () => {
    render({ kind: 'gap', reason: 'detached', actionable: true, sinceAt: 't' });
    expect(currentSrc(container)).toBe(HERO6_MENU_IDLE_FRAMES[0]);

    act(() => {
      vi.advanceTimersByTime(HERO6_MENU_IDLE_FRAME_MS);
    });
    expect(currentSrc(container)).toBe(HERO6_MENU_IDLE_FRAMES[1]);
  });

  it('advances frames while reading the account for the first time', () => {
    render({ kind: 'live' });

    act(() => {
      vi.advanceTimersByTime(HERO6_MENU_IDLE_FRAME_MS);
    });
    expect(currentSrc(container)).toBe(HERO6_MENU_IDLE_FRAMES[1]);
  });

  it('holds the first frame still while consent is missing — nothing is actually in progress there', () => {
    render({ kind: 'gap', reason: 'consentMissing', actionable: true, sinceAt: 't' });
    expect(currentSrc(container)).toBe(HERO6_MENU_IDLE_FRAMES[0]);

    act(() => {
      vi.advanceTimersByTime(HERO6_MENU_IDLE_FRAME_MS * 5);
    });
    expect(currentSrc(container)).toBe(HERO6_MENU_IDLE_FRAMES[0]);
  });
});
