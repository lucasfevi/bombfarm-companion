import type { ReactNode } from 'react';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import { HeroAvatar, rarityTextClass } from '@bombfarm/game-art';
import { useLocale } from '../../lib/copy';
import type { LiveHeroFact } from '../../lib/live/live-model';

/** `ArtFrame`'s own middle-of-the-road default (Raro) — used when the roster join has not
 *  caught up to this hero yet and there is no rarity to tint the frame with. */
const NEUTRAL_RARITY_IDX = 2;

export function HeroRow({ hero, trailing }: { hero: LiveHeroFact; trailing?: ReactNode }) {
  const { lang } = useLocale();
  // Name and grade arrive from the same roster join, so a grade without a name is half a join —
  // rendering it would put a rank letter beside a bare id as though both were known.
  const grade = hero.name !== undefined ? hero.grade?.trim() : undefined;
  const stars = Math.max(0, Math.min(3, Math.round(hero.stars ?? 0)));

  return (
    <li
      data-testid={`live-hero-row-${hero.id}`}
      className="flex items-center justify-between gap-3 border-b border-line py-1.5 last:border-b-0"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="shrink-0">
          <HeroAvatar
            skin={hero.skin ?? 0}
            rarityIdx={hero.rarity ?? NEUTRAL_RARITY_IDX}
            size="xs"
            name={hero.name ?? hero.id}
          />
        </span>
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="shrink-0 text-[13px] leading-none font-black tracking-tight">
            <span className={grade ? 'text-accent' : 'text-muted'}>{grade || '—'}</span>
          </span>
          <span
            data-testid={`live-hero-row-${hero.id}-name`}
            className="truncate text-[13px] leading-none font-bold text-ink"
          >
            {hero.name ?? hero.id}
          </span>
          {hero.stars !== undefined && stars > 0 ? (
            <span className="shrink-0 text-[10px] leading-none tracking-tight text-rar-4" aria-hidden>
              {'★'.repeat(stars)}
            </span>
          ) : null}
          {hero.rarity !== undefined ? (
            <span className="shrink-0 truncate text-[10px] leading-none font-bold">
              <span className={rarityTextClass(hero.rarity) ?? 'text-muted'}>
                {rarityLabel(RARITIES[hero.rarity], lang)}
              </span>
            </span>
          ) : null}
        </span>
      </span>
      {trailing}
    </li>
  );
}
