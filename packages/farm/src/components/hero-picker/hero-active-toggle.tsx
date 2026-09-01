'use client';

import { Switch, Tooltip, cn } from '@bombfarm/ui';
import type { FarmRosterCopy } from '../../copy';

type Props = {
  battleAllowed: boolean;
  t: FarmRosterCopy;
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
  const tip = battleAllowed ? t.heroBattleActiveTitle : t.heroBattleInactiveTitle;
  const labelClass = 'col-start-1 row-start-1 text-[11px] leading-none font-bold tracking-wider uppercase';

  return (
    <div
      className={cn('inline-flex items-center gap-1.5', className)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Tooltip.Provider delay={200} closeDelay={80}>
        <Tooltip.Root>
          <Tooltip.Trigger
            render={<span />}
            className="inline-flex items-center gap-1.5"
          >
            <Switch
              checked={battleAllowed}
              onCheckedChange={onCheckedChange}
              aria-label={t.heroBattleToggleAria}
            />
            {showLabel ? (
              <span className="grid justify-items-start">
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
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner sideOffset={6}>
              <Tooltip.Popup>
                <p className="m-0 text-[12px]">{tip}</p>
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    </div>
  );
}
