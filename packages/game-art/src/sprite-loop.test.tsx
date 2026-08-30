// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SpriteLoop } from './sprite-loop';

// react-dom/client warns that act() is unsupported unless this is set — normally a testing
// harness does it for you; there is none here, so it's set by hand.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FRAMES = ['/frame-1.png', '/frame-2.png', '/frame-3.png'];
const FRAME_MS = 100;

function stubMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
}

function currentSrc(container: HTMLDivElement): string | null {
  return container.querySelector('img')?.getAttribute('src') ?? null;
}

describe('SpriteLoop', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    stubMatchMedia(false);
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

  it('renders the first frame initially', () => {
    act(() => {
      root.render(createElement(SpriteLoop, { frames: FRAMES, frameDurationMs: FRAME_MS }));
    });
    expect(currentSrc(container)).toBe(FRAMES[0]);
  });

  it('advances on the timer when reduced motion is not set', () => {
    act(() => {
      root.render(createElement(SpriteLoop, { frames: FRAMES, frameDurationMs: FRAME_MS }));
    });
    act(() => {
      vi.advanceTimersByTime(FRAME_MS);
    });
    expect(currentSrc(container)).toBe(FRAMES[1]);

    act(() => {
      vi.advanceTimersByTime(FRAME_MS);
    });
    expect(currentSrc(container)).toBe(FRAMES[2]);

    // Wraps back to the first frame rather than reading past the end.
    act(() => {
      vi.advanceTimersByTime(FRAME_MS);
    });
    expect(currentSrc(container)).toBe(FRAMES[0]);
  });

  it('stays on the first frame and never advances when reduced motion is set', () => {
    stubMatchMedia(true);
    act(() => {
      root.render(createElement(SpriteLoop, { frames: FRAMES, frameDurationMs: FRAME_MS }));
    });
    expect(currentSrc(container)).toBe(FRAMES[0]);

    act(() => {
      vi.advanceTimersByTime(FRAME_MS * 5);
    });
    expect(currentSrc(container)).toBe(FRAMES[0]);
  });

  it('holds the first frame still and never advances when animate is false', () => {
    act(() => {
      root.render(createElement(SpriteLoop, { frames: FRAMES, frameDurationMs: FRAME_MS, animate: false }));
    });
    expect(currentSrc(container)).toBe(FRAMES[0]);

    act(() => {
      vi.advanceTimersByTime(FRAME_MS * 5);
    });
    expect(currentSrc(container)).toBe(FRAMES[0]);
  });

  it('resumes advancing once animate turns true again', () => {
    act(() => {
      root.render(createElement(SpriteLoop, { frames: FRAMES, frameDurationMs: FRAME_MS, animate: false }));
    });
    act(() => {
      root.render(createElement(SpriteLoop, { frames: FRAMES, frameDurationMs: FRAME_MS, animate: true }));
    });
    act(() => {
      vi.advanceTimersByTime(FRAME_MS);
    });
    expect(currentSrc(container)).toBe(FRAMES[1]);
  });

  it('cleans up its interval and its media-query listener on unmount', () => {
    const removeEventListener = vi.fn();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener,
    }) as unknown as typeof window.matchMedia;
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

    act(() => {
      root.render(createElement(SpriteLoop, { frames: FRAMES, frameDurationMs: FRAME_MS }));
    });

    act(() => {
      root.unmount();
    });

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    // afterEach's own unmount() is a no-op on an already-unmounted root.
  });
});
