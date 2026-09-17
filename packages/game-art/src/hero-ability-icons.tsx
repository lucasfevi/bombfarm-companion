'use client';

import type { SyntheticEvent } from 'react';
import { heroAbilityIconEntries } from '@bombfarm/domain/hero-abilities';
import type { Lang } from '@bombfarm/domain/shims/i18n';

import { cn } from '@bombfarm/ui';
import { AbilityIcon } from './ability-icon';
import { type AbilityIconRecipeSize } from './game-art.recipe';

type Props = {
  abilities: Record<string, number>;
  lang: Lang;
  className?: string;
  size?: AbilityIconRecipeSize;
  /** Off, the icon carries no level badge; the card and the accessible name still read it. */
  showLevel?: boolean;
};

function stopRowActivation(event: SyntheticEvent) {
  event.stopPropagation();
}

/** A hero's abilities as tiles — each opens the ability's card on hover. */
export function HeroAbilityIcons({
  abilities,
  lang,
  className,
  size = 'lg',
  showLevel = true,
}: Props) {
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
      {entries.map(({ id, level, max }) =>
        showLevel ? (
          <AbilityIcon key={id} code={id} size={size} level={level} max={max} peek={{ lang, level, max, stopRowActivation: true }} />
        ) : (
          <AbilityIcon key={id} code={id} size={size} peek={{ lang, level, max, stopRowActivation: true }} />
        ),
      )}
    </span>
  );
}
