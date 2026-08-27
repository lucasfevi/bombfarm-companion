'use client';

import type { SyntheticEvent } from 'react';
import { SLOTS, type Loadout } from '@bombfarm/domain/gear';
import type { Lang } from '@bombfarm/domain/shims/i18n';
import { formatItemRosterTooltip, slotLabel } from '@bombfarm/domain/game-labels';

import { cn, Tooltip } from '@bombfarm/ui';
import { ItemIcon } from './item-icon';
import { artFrameRadiusClass, rosterIconTooltipTriggerClass } from './game-art.recipe';

type Props = {
  loadout: Loadout;
  lang: Lang;
  className?: string;
  /** Accessible name for an empty gear slot's tooltip trigger, given the slot's own label. */
  emptySlotAriaLabel?: (slotName: string) => string;
  /** Tooltip body for an empty gear slot. */
  emptySlotTip?: string;
  /** Rank/level prefix for the equipped-item tooltip subtitle (e.g. "Lv"). */
  lvLabel?: string;
};

const emptyGearClass = cn(
  'inline-grid w-12 aspect-[18/19] shrink-0 border border-dashed border-line bg-[color-mix(in_oklch,var(--bg)_55%,var(--surface))]',
  artFrameRadiusClass,
);

function stopRowActivation(event: SyntheticEvent) {
  event.stopPropagation();
}

export function HeroGearIcons({
  loadout,
  lang,
  className,
  emptySlotAriaLabel = (slotName) => `${slotName} — empty`,
  emptySlotTip = 'Empty',
  lvLabel = 'Lv',
}: Props) {
  return (
    <span
      className={cn('inline-flex flex-nowrap items-center gap-0.5', className)}
      onClick={stopRowActivation}
      onKeyDown={stopRowActivation}
    >
      {SLOTS.map((slot) => {
        const equipped = loadout[slot];
        const slotName = slotLabel(slot, lang);
        if (!equipped) {
          return (
            <Tooltip.Root key={slot}>
              <Tooltip.Trigger
                type="button"
                tabIndex={-1}
                aria-label={emptySlotAriaLabel(slotName)}
                className={rosterIconTooltipTriggerClass}
                onClick={stopRowActivation}
                onKeyDown={stopRowActivation}
              >
                <span className={emptyGearClass} aria-hidden="true" />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={6}>
                  <Tooltip.Popup>
                    <p className="m-0 font-semibold text-ink">{slotName}</p>
                    <p className="m-0 text-xs text-muted">{emptySlotTip}</p>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          );
        }

        const tip = formatItemRosterTooltip(equipped, lang, lvLabel);
        const aria = `${tip.title}. ${tip.subtitle}`;
        return (
          <Tooltip.Root key={slot}>
            <Tooltip.Trigger
              type="button"
              tabIndex={-1}
              aria-label={aria}
              className={rosterIconTooltipTriggerClass}
              onClick={stopRowActivation}
              onKeyDown={stopRowActivation}
            >
              <ItemIcon equipped={equipped} size="lg" />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={6}>
                <Tooltip.Popup>
                  <p className="m-0 font-semibold text-ink">{tip.title}</p>
                  <p className="m-0 text-xs text-muted">{tip.subtitle}</p>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        );
      })}
    </span>
  );
}
