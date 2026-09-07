'use client';

import { useEffect, useState } from 'react';

/** The rendered height of the content, followed as it changes, so a wrapper can animate to it.
 *  Undefined until measured — the first paint is at the natural height, with no transition. */
export function useContentHeight(): {
  ref: (node: HTMLDivElement | null) => void;
  height: number | undefined;
} {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (node === null || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      setHeight(node.getBoundingClientRect().height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [node]);
  return { ref: setNode, height };
}
