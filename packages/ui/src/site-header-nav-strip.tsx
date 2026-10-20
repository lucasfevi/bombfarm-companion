'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { siteHeaderNavStripClass } from './site-header.recipe';

export interface SiteHeaderNavStripProps {
  children: ReactNode;
  /** The active item is centred again whenever this changes, as well as on mount. */
  recenterKey?: string | number | undefined;
}

export function SiteHeaderNavStrip({ children, recenterKey }: SiteHeaderNavStripProps) {
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const strip = stripRef.current;
    const active = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!strip || !active) return;
    strip.scrollLeft = active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2;
  }, [recenterKey]);

  return (
    <div ref={stripRef} className={siteHeaderNavStripClass}>
      {children}
    </div>
  );
}
