import type { ReactNode } from 'react';
import { Chip } from '@bombfarm/ui';
import type { LiveHeroFact } from '../../lib/live/live-model';

export function HeroRow({ hero, trailing }: { hero: LiveHeroFact; trailing?: ReactNode }) {
  const showGrade = hero.name !== undefined && hero.grade !== undefined;

  return (
    <li
      data-testid={`live-hero-row-${hero.id}`}
      className="flex items-center justify-between gap-3 border-b border-line py-1.5 last:border-b-0"
    >
      <span className="flex items-center gap-2">
        <span data-testid={`live-hero-row-${hero.id}-name`}>{hero.name ?? hero.id}</span>
        {showGrade ? <Chip variant="small">{hero.grade}</Chip> : null}
      </span>
      {trailing}
    </li>
  );
}
