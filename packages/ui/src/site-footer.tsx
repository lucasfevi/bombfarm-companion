import type { ReactNode } from 'react';
import { cn } from './cn';
import {
  siteFooterClass,
  siteFooterLegalClass,
  siteFooterRowClass,
  siteFooterTrailingAloneClass,
  siteFooterTrailingClass,
} from './site-footer.recipe';

export interface SiteFooterProps {
  /** Left slot, wrapped in a `<p>`: pass phrasing content only. */
  legal?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

export function SiteFooter({ legal, trailing, className }: SiteFooterProps) {
  const hasLegal = legal != null;
  return (
    <footer className={cn(siteFooterClass, className)}>
      <div className={siteFooterRowClass}>
        {hasLegal ? <p className={siteFooterLegalClass}>{legal}</p> : null}
        {trailing != null ? (
          <div className={cn(siteFooterTrailingClass, !hasLegal && siteFooterTrailingAloneClass)}>{trailing}</div>
        ) : null}
      </div>
    </footer>
  );
}
