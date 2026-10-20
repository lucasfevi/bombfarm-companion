import type { ReactNode } from 'react';
import { cn } from './cn';
import { SiteHeaderNavStrip } from './site-header-nav-strip';
import {
  siteHeaderActionsClass,
  siteHeaderClass,
  siteHeaderCompactActionsClass,
  siteHeaderHideBelowSmClass,
  siteHeaderHideFromSmClass,
  siteHeaderLeadClass,
  siteHeaderRowClass,
} from './site-header.recipe';

export interface SiteHeaderProps {
  brand: ReactNode;
  nav?: ReactNode;
  actions?: ReactNode;
  /** Replaces `actions` below 640px. Without it, `actions` stay visible at every width. */
  compactActions?: ReactNode;
  /**
   * Opt in to choosing the branch in JavaScript: when defined, only the matching branch is
   * rendered and no class hides the other. Leave it out and both branches are in the markup, with
   * CSS showing one.
   */
  compact?: boolean | undefined;
  /** Re-centres the active nav item whenever it changes. */
  navRecenterKey?: string | number | undefined;
  className?: string;
}

export function SiteHeader({
  brand,
  nav,
  actions,
  compactActions,
  compact,
  navRecenterKey,
  className,
}: SiteHeaderProps) {
  const hasActions = actions != null;
  const hasCompact = compactActions != null;
  const chooseInScript = compact !== undefined;
  const showCompact = hasCompact && (!chooseInScript || compact === true);
  const showWide = hasActions && (!chooseInScript || compact !== true || !hasCompact);
  const hideWideBelowSm = !chooseInScript && hasCompact;

  return (
    <header className={cn(siteHeaderClass, className)}>
      <div className={siteHeaderRowClass}>
        <div className={siteHeaderLeadClass}>
          {brand}
          {nav != null ? <SiteHeaderNavStrip recenterKey={navRecenterKey}>{nav}</SiteHeaderNavStrip> : null}
        </div>
        {showCompact ? (
          <div className={cn(siteHeaderCompactActionsClass, !chooseInScript && siteHeaderHideFromSmClass)}>
            {compactActions}
          </div>
        ) : null}
        {showWide ? (
          <div className={cn(siteHeaderActionsClass, hideWideBelowSm && siteHeaderHideBelowSmClass)}>
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
