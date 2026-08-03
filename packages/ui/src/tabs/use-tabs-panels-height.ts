import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Measures the active tab panel's height (border-box aware, DPR-rounded) and keeps it in
 * sync via `ResizeObserver` so `Tabs.Panels`' outer shell can animate to it. Extracted
 * verbatim from `Tabs.Panels` (W6) — `measure`, the effect wiring, and the dependency
 * array are unchanged.
 */
export function useTabsPanelsHeight(activeIndex: number, childrenLength: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [height, setHeight] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);

  const measure = useCallback((index: number) => {
    const pane = itemRefs.current[index];
    const container = containerRef.current;
    if (!pane || !container) return 0;

    const base = pane.getBoundingClientRect().height || 0;
    const computedStyle = getComputedStyle(container);
    const isBorderBox = computedStyle.boxSizing === 'border-box';
    const paddingY =
      (parseFloat(computedStyle.paddingTop || '0') || 0) +
      (parseFloat(computedStyle.paddingBottom || '0') || 0);
    const borderY =
      (parseFloat(computedStyle.borderTopWidth || '0') || 0) +
      (parseFloat(computedStyle.borderBottomWidth || '0') || 0);

    const rawTotal = base + (isBorderBox ? paddingY + borderY : 0);
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const total = Math.ceil(rawTotal * dpr) / dpr;
    return total;
  }, []);

  useEffect(() => {
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }

    const pane = itemRefs.current[activeIndex];
    const container = containerRef.current;
    if (!pane || !container || activeIndex < 0) return;

    setHeight(measure(activeIndex));

    const resizeObserver = new ResizeObserver(() => {
      const next = measure(activeIndex);
      requestAnimationFrame(() => setHeight(next));
    });
    resizeObserver.observe(pane);
    resizeObserver.observe(container);
    roRef.current = resizeObserver;
    return () => {
      resizeObserver.disconnect();
      roRef.current = null;
    };
  }, [activeIndex, childrenLength, measure]);

  useLayoutEffect(() => {
    if (height === 0 && activeIndex >= 0) {
      const next = measure(activeIndex);
      if (next !== 0) setHeight(next);
    }
  }, [activeIndex, height, measure]);

  return { containerRef, itemRefs, height };
}
