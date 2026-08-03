'use client';

import type { SyntheticEvent } from 'react';
import { SLOTS, type Loadout } from '@bombfarm/domain/gear';
import type { Lang, Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { formatItemRosterTooltip, slotLabel } from '@bombfarm/domain/game-labels';

import { cn, Tooltip } from '@bombfarm/ui';
import { ItemIcon } from '@/shared/game-art/item-icon';
import {
  artFrameRadiusClass,
  rosterIconTooltipTriggerClass,
} from '@/shared/game-art/game-art.recipe';

type Props = {
  loadout: Loadout;
  lang: Lang;
  t: Strings;
  className?: string;
};

const emptyGearClass = cn(
  'inline-grid size-7 shrink-0 border border-dashed border-line bg-[color-mix(in_oklch,var(--bg)_55%,var(--surface))]',
  artFrameRadiusClass,
);

function stopRowActivation(event: SyntheticEvent) {
  event.stopPropagation();
}

export function HeroGearIcons({ loadout, lang, t, className }: Props) {
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
          const emptyAria = sub(t.gearSlotEmptyAria, { slot: slotName });
          return (
            <Tooltip.Root key={slot}>
              <Tooltip.Trigger
                type="button"
                tabIndex={-1}
                aria-label={emptyAria}
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
                    <p className="m-0 text-xs text-muted">{t.gearSlotEmptyTip}</p>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          );
        }

        const tip = formatItemRosterTooltip(equipped, lang, t.rankLv);
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
              <ItemIcon equipped={equipped} size="xs" showUpgrade={false} />
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
