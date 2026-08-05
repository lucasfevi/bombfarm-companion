'use client';

import type { SyntheticEvent } from 'react';
import { abilityName } from '@bombfarm/domain/game-labels';
import { heroAbilityIconEntries } from '@bombfarm/domain/hero-abilities';
import type { Lang } from '@/shared/i18n';

import { cn, Tooltip } from '@bombfarm/ui';
import { AbilityIcon } from '@/shared/game-art/ability-icon';
import { rosterIconTooltipTriggerClass } from '@/shared/game-art/game-art.recipe';

type Props = {
  abilities: Record<string, number>;
  lang: Lang;
  className?: string;
};

function stopRowActivation(event: SyntheticEvent) {
  event.stopPropagation();
}

export function HeroAbilityIcons({ abilities, lang, className }: Props) {
  const entries = heroAbilityIconEntries(abilities);

  if (entries.length === 0) {
    return <span className="text-muted">—</span>;
  }

  return (
    <span
      className={cn('inline-flex flex-wrap items-center gap-0.5', className)}
      onClick={stopRowActivation}
      onKeyDown={stopRowActivation}
    >
      {entries.map(({ id, level, max }) => {
        const name = abilityName(id, lang);
        const label = `${name}, ${level}/${max}`;
        return (
          <Tooltip.Root key={id}>
            <Tooltip.Trigger
              type="button"
              tabIndex={-1}
              aria-label={label}
              className={rosterIconTooltipTriggerClass}
              onClick={stopRowActivation}
              onKeyDown={stopRowActivation}
            >
              <AbilityIcon code={id} size="lg" level={level} max={max} />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={6}>
                <Tooltip.Popup>
                  <p className="m-0 font-semibold text-ink">{name}</p>
                  <p className="m-0 text-xs text-muted">
                    {level}/{max}
                  </p>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        );
      })}
    </span>
  );
}
