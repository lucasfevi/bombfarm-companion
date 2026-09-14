import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createTabScrollMemory } from './tab-scroll-memory';

/**
 * `useState` for the active tab, with the scroller's offset remembered per tab. The outgoing
 * tab's offset is read in the setter, before React commits — by the time an effect could look,
 * the old content is gone and the scroller has already been clamped. The incoming tab's offset
 * is put back in a layout effect, on the first commit that draws it, so the frame the player
 * sees is already where they left it; content shorter than that offset clamps to its own end.
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
    if (element !== null) element.scrollTop = memoryRef.current.enter(activeTabId);
  }, [activeTabId, scroller]);

  return [activeTabId, setActiveTabId];
}
