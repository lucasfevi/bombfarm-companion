import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createTabScrollMemory } from './tab-scroll-memory';

/** How long the restore keeps chasing content that lands after the first commit. */
const RESTORE_WINDOW_MS = 1000;

/**
 * `useState` for the active tab, with the scroller's offset remembered per tab. The outgoing
 * tab's offset is read in the setter, before React commits — by the time an effect could look,
 * the old content is gone and the scroller has already been clamped. The incoming tab's offset
 * is put back in a layout effect, on the first commit that draws it, and then again as the
 * content grows: a tab whose first commit is shorter than the page it settles to would clamp a
 * single set. The player scrolling themselves ends the restore at once.
 */
export function useTabScrollMemory(
  initialTabId: string,
  scroller: RefObject<HTMLElement | null>,
): [activeTabId: string, setActiveTabId: (tabId: string) => void] {
  const [activeTabId, setActiveTabIdState] = useState(initialTabId);
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const memoryRef = useRef(createTabScrollMemory());

  const setActiveTabId = useCallback(
    (tabId: string) => {
      const element = scroller.current;
      if (element !== null) memoryRef.current.leave(activeTabIdRef.current, element.scrollTop);
      setActiveTabIdState(tabId);
    },
    [scroller],
  );

  useLayoutEffect(() => {
    const element = scroller.current;
    if (element === null) return;
    return restoreScrollTop(element, memoryRef.current.enter(activeTabId));
  }, [activeTabId, scroller]);

  return [activeTabId, setActiveTabId];
}

function restoreScrollTop(element: HTMLElement, wanted: number): () => void {
  element.scrollTop = wanted;
  const measure = element.firstElementChild;
  if (element.scrollTop === wanted || measure === null || typeof ResizeObserver === 'undefined') {
    return () => {};
  }

  const observer = new ResizeObserver(() => {
    element.scrollTop = wanted;
    if (element.scrollTop === wanted) stop();
  });
  const deadline = window.setTimeout(() => {
    stop();
  }, RESTORE_WINDOW_MS);
  function stop(): void {
    observer.disconnect();
    window.clearTimeout(deadline);
    for (const type of PLAYER_SCROLL_EVENTS) element.removeEventListener(type, stop);
  }
  for (const type of PLAYER_SCROLL_EVENTS) element.addEventListener(type, stop, { passive: true });
  observer.observe(measure);
  return stop;
}

const PLAYER_SCROLL_EVENTS = ['wheel', 'pointerdown', 'touchstart', 'keydown'] as const;
