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
        <span
          className={cn(
            'text-[11px] leading-none font-bold tracking-wider uppercase',
            battleAllowed ? 'text-accent' : 'text-warn',
          )}
          title={title}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
