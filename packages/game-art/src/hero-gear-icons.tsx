'use client';

import type { SyntheticEvent } from 'react';
import { SLOTS, type Loadout } from '@bombfarm/domain/gear';
import type { Lang } from '@bombfarm/domain/shims/i18n';
import { slotLabel } from '@bombfarm/domain/game-labels';

import { cn, Tooltip } from '@bombfarm/ui';
import { ItemIcon } from './item-icon';
import { emptyGearSlotClass, rosterIconTooltipTriggerClass } from './game-art.recipe';

type Props = {
  loadout: Loadout;
  lang: Lang;
  className?: string;
  /** Accessible name for an empty gear slot's tooltip trigger, given the slot's own label. */
  emptySlotAriaLabel?: (slotName: string) => string;
  /** Tooltip body for an empty gear slot. */
  emptySlotTip?: string;
};

function stopRowActivation(event: SyntheticEvent) {
  event.stopPropagation();
}

/** A hero's eight gear slots as tiles — each filled one opens the item's card on hover. */
export function HeroGearIcons({
  loadout,
  lang,
  className,
  emptySlotAriaLabel = (slotName) => `${slotName} — empty`,
  emptySlotTip = 'Empty',
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
                render={<span role="img" />}
                tabIndex={-1}
                aria-label={emptySlotAriaLabel(slotName)}
                delay={200}
                closeDelay={80}
                className={rosterIconTooltipTriggerClass}
                onClick={stopRowActivation}
                onKeyDown={stopRowActivation}
              >
                <span className={emptyGearSlotClass} aria-hidden="true" />
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

        return <ItemIcon key={slot} item={equipped} size="lg" peek={{ lang, stopRowActivation: true }} />;
      })}
    </span>
  );
}
