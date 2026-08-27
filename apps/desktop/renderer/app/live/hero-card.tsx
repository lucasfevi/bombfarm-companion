import type { ReactNode } from 'react';
import { HeroIdentity } from '@bombfarm/game-art';
import { useLocale } from '../../lib/copy';
import type { LiveHeroFact } from '../../lib/live/live-model';
import { EnergyBar } from './energy-bar';

/**
 * `muted` is selected by a `data-muted` attribute inside the one class literal rather than by
 * branching around two of them: the shell's untranslated-prose guard only tolerates a multi-class
 * string written directly as `className="…"`, so a composed or interpolated form is reported as
 * player-facing text.
 */
export function HeroCard({
  hero,
  muted = false,
  trailing,
}: {
  hero: LiveHeroFact;
  /** Drains the card's colour — a hero who is out of the rotation entirely, not resting inside it. */
  muted?: boolean;
  trailing?: ReactNode;
}) {
  const { lang } = useLocale();
  // Name and grade arrive from the same roster join, so a grade without a name is half a join —
  // rendering it would put a rank letter beside a bare id as though both were known.
  const rank = hero.name !== undefined ? hero.grade?.trim() : undefined;

  return (
    <li
      data-testid={`live-hero-card-${hero.id}`}
      data-muted={muted ? '' : undefined}
      className="flex flex-col gap-2 rounded-sm border border-line bg-[color-mix(in_oklch,var(--surface)_92%,transparent)] px-2 py-1.5 shadow-[inset_0_1px_0_color-mix(in_oklch,var(--line)_28%,transparent)] data-[muted]:opacity-60 data-[muted]:grayscale"
    >
      <div className="flex items-center justify-between gap-2">
        <HeroIdentity
          name={hero.name ?? hero.id}
          rank={rank}
          rarityIdx={hero.rarity}
          stars={hero.stars}
          level={hero.level}
          skin={hero.skin}
          lang={lang}
          size="md"
          variant="stacked"
          nameTestId={`live-hero-card-${hero.id}-name`}
        />
        {trailing}
      </div>
      <EnergyBar testId={`live-energy-${hero.id}`} fraction={hero.energyFraction} />
    </li>
  );
}
