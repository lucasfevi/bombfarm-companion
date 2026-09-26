import { HeroAvatar } from '@bombfarm/game-art';
import { cn, formatCompactNumber } from '@bombfarm/ui';
import { showcaseCopyFor, type Lang, type ShareCardCopy } from '../../copy';
import type { RosterHeroRow } from '../../model';
import { BirthGradeLetter } from '../roster-board/birth-grade-letter';
import { ShareDpsLine } from './share-card-featured';
import { RarityLevel, ShareAbilityIcons, ShareStars, rarityIndexOf, shareWellClass } from './share-card-parts';

const NOT_PLACED = '—';

/** Small enough for six to sit beside the rarity line in half the card; no level, no outline. */
const MINI_ABILITY_TILE = 'size-4 border-0 rounded-[3px]';
const MINI_ABILITY_GAP_PX = 2;

export function ShareRestRow({
  row,
  dps,
  copy,
  lang,
}: {
  row: RosterHeroRow;
  dps: number | undefined;
  copy: ShareCardCopy;
  lang: Lang;
}) {
  const { hero } = row;
  const grade = hero.rank?.trim();
  return (
    <div
      className={cn(shareWellClass, 'grid', 'min-w-0', 'grid-cols-[38px_minmax(0,1fr)]', 'items-center', 'gap-x-2.5', 'gap-y-[3px]', 'py-[7px]', 'pr-2.5', 'pl-[7px]')}
      data-testid={`share-card-rest-${row.id}`}
    >
      <HeroAvatar
        skin={hero.skin ?? 0}
        rarityIdx={rarityIndexOf(hero)}
        size="xl"
        className="row-span-2 w-[38px]"
        name={hero.name}
      />
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="m-0 flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-ink">
          {grade ? (
            <BirthGradeLetter grade={grade} copy={showcaseCopyFor(lang)} size="sm" testId="share-card-grade" />
          ) : null}
          <span className="truncate">{hero.name}</span>
          <ShareStars stars={hero.stars} />
        </p>
        <p className="m-0 flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
          <span className="font-mono text-[15px] font-bold tabular-nums text-accent">
            {hero.power == null ? NOT_PLACED : formatCompactNumber(hero.power, lang)}
          </span>
          <ShareDpsLine dps={dps} copy={copy} lang={lang} heroId={row.id} className="text-[11px]" />
        </p>
      </div>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <RarityLevel hero={hero} copy={copy} lang={lang} />
        <span className="shrink-0">
          <ShareAbilityIcons abilities={hero.abilities} tileClassName={MINI_ABILITY_TILE} gapPx={MINI_ABILITY_GAP_PX} />
        </span>
      </div>
    </div>
  );
}
