'use client';

import type { Strings } from '@/shared/i18n';
import { Switch, cn } from '@bombfarm/ui';

type Props = {
  battleAllowed: boolean;
  t: Strings;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  /** Compact label beside the switch (strip + picker). */
  showLabel?: boolean;
};

/**
 * Planner enable/disable for a hero — maps to persisted `battleAllowed`.
 * Disabled heroes are excluded from roster respec recommendations.
 */
export function HeroActiveToggle({
  battleAllowed,
  t,
  onCheckedChange,
  className,
  showLabel = true,
}: Props) {
  const label = battleAllowed ? t.heroBattleActive : t.heroBattleInactive;
  const title = battleAllowed ? t.heroBattleActiveTitle : t.heroBattleInactiveTitle;
  const labelClass = 'col-start-1 row-start-1 text-[11px] leading-none font-bold tracking-wider uppercase';

  return (
    <div
      className={cn('inline-flex items-center gap-1.5', className)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Switch
        checked={battleAllowed}
        onCheckedChange={onCheckedChange}
        aria-label={t.heroBattleToggleAria}
        title={title}
      />
      {showLabel ? (
        <span className="grid justify-items-start" title={title}>
          <span className={cn(labelClass, 'invisible')} aria-hidden>
            {t.heroBattleActive}
          </span>
          <span className={cn(labelClass, 'invisible')} aria-hidden>
            {t.heroBattleInactive}
          </span>
          <span className={cn(labelClass, battleAllowed ? 'text-accent' : 'text-warn')}>
            {label}
          </span>
        </span>
      ) : null}
    </div>
  );
}
