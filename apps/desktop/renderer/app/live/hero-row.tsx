import type { ReactNode } from 'react';
import { HeroIdentity } from '@bombfarm/game-art';
import { useLocale } from '../../lib/copy';
import type { LiveHeroFact } from '../../lib/live/live-model';

export function HeroRow({ hero, trailing }: { hero: LiveHeroFact; trailing?: ReactNode }) {
  const { lang } = useLocale();
  // Name and grade arrive from the same roster join, so a grade without a name is half a join —
  // rendering it would put a rank letter beside a bare id as though both were known.
  const rank = hero.name !== undefined ? hero.grade?.trim() : undefined;

  return (
    <li
      data-testid={`live-hero-row-${hero.id}`}
      className="flex items-center justify-between gap-3 border-b border-line py-1.5 last:border-b-0"
    >
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
        nameTestId={`live-hero-row-${hero.id}-name`}
      />
      {trailing}
    </li>
  );
}
