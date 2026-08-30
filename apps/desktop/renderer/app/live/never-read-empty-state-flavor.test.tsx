// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { en } from '../../lib/copy/en';
import { ptBR } from '../../lib/copy/pt-BR';
import { NeverReadEmptyState } from './never-read-empty-state';
import { WAITING_FLAVOR_LINE_KEYS } from './waiting-flavor-line';
import type { ReachedLiveFreshness } from './freshness-line';

// react-dom/client warns that act() is unsupported unless this is set — matches
// never-read-empty-state-sprite.test.tsx's own established setup.
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

function matchMediaMock(matches: boolean) {
  const listeners = new Set<() => void>();
  return {
    matches,
    addEventListener: (_type: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
  };
}

const FLAVOR_LINES_EN = WAITING_FLAVOR_LINE_KEYS.map((key) => en[key]);

describe('NeverReadEmptyState — the waiting flavour line', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
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

  it('renders one of the flavour lines while the read is genuinely pending', () => {
    window.matchMedia = vi.fn().mockReturnValue(matchMediaMock(false));
    render({ kind: 'live' });

    expect(container.textContent).toContain(FLAVOR_LINES_EN[0]);
  });

  it('renders nothing extra when consent is what is blocking — nothing is actually pending there', () => {
    window.matchMedia = vi.fn().mockReturnValue(matchMediaMock(false));
    render({ kind: 'gap', reason: 'consentMissing', actionable: true, sinceAt: 't' });

    for (const line of FLAVOR_LINES_EN) {
      expect(container.textContent).not.toContain(line);
    }
  });

  it('still shows a flavour line for a gap the app is retrying on its own', () => {
    window.matchMedia = vi.fn().mockReturnValue(matchMediaMock(false));
    render({ kind: 'gap', reason: 'detached', actionable: true, sinceAt: 't' });

    expect(container.textContent).toContain(FLAVOR_LINES_EN[0]);
  });

  it('rotates through the lines over time when motion is not reduced', () => {
    window.matchMedia = vi.fn().mockReturnValue(matchMediaMock(false));
    render({ kind: 'live' });

    expect(container.textContent).toContain(FLAVOR_LINES_EN[0]);

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(container.textContent).toContain(FLAVOR_LINES_EN[1]);

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(container.textContent).toContain(FLAVOR_LINES_EN[2]);
  });

  it('holds a single line and never rotates under prefers-reduced-motion', () => {
    window.matchMedia = vi.fn().mockReturnValue(matchMediaMock(true));
    render({ kind: 'live' });

    expect(container.textContent).toContain(FLAVOR_LINES_EN[0]);

    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(container.textContent).toContain(FLAVOR_LINES_EN[0]);
    for (const line of FLAVOR_LINES_EN.slice(1)) {
      expect(container.textContent).not.toContain(line);
    }
  });
});

describe('WAITING_FLAVOR_LINE_KEYS — every line resolves in both languages', () => {
  it('has between three and five lines, each a non-empty string in en and pt-BR', () => {
    expect(WAITING_FLAVOR_LINE_KEYS.length).toBeGreaterThanOrEqual(3);
    expect(WAITING_FLAVOR_LINE_KEYS.length).toBeLessThanOrEqual(5);
    for (const key of WAITING_FLAVOR_LINE_KEYS) {
      expect(typeof en[key]).toBe('string');
      expect(en[key].length).toBeGreaterThan(0);
      expect(typeof ptBR[key]).toBe('string');
      expect(ptBR[key].length).toBeGreaterThan(0);
    }
  });
});
