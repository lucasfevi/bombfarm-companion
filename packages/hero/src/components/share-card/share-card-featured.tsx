import { SLOTS } from '@bombfarm/domain/gear';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { CSSProperties } from 'react';
import { ART_TILE_SIZE_VAR, HeroAvatar, ItemIcon, artFrameRadiusClass } from '@bombfarm/game-art';
import { cn, formatCompactNumber } from '@bombfarm/ui';
import { showcaseCopyFor, type Lang, type ShareCardCopy } from '../../copy';
import { shareDpsText, type RosterHeroRow, type ShareCardSettings } from '../../model';
import { BirthGradeLetter } from '../roster-board/birth-grade-letter';
import { RarityLevel, ShareAbilityIcons, ShareStars, rarityIndexOf, shareWellClass } from './share-card-parts';

const NOT_PLACED = '—';

/** Six abilities have to sit on one line inside a third of the card. */
const FEATURED_ABILITY_TILE = 'size-[26px]';
const FEATURED_ABILITY_GAP_PX = 3;

const FEATURED_GEAR_COLUMNS = 4;
const FEATURED_GEAR_GAP_PX = 3;
/** Four gear tiles fill the featured tile's width, so the level and forge glyphs stay legible. */
const FEATURED_GEAR_TILE_STYLE = {
  [ART_TILE_SIZE_VAR]: `calc((100cqi - ${String((FEATURED_GEAR_COLUMNS - 1) * FEATURED_GEAR_GAP_PX)}px) / ${String(FEATURED_GEAR_COLUMNS)})`,
} as CSSProperties;

export type ShareFeaturedHero = {
  readonly row: RosterHeroRow;
  readonly medal: string;
  readonly dps: number | undefined;
};

export function ShareFeaturedTile({
  featured,
  show,
  copy,
  lang,
}: {
  featured: ShareFeaturedHero;
  show: Pick<ShareCardSettings, 'showGear' | 'showLevels'>;
  copy: ShareCardCopy;
  lang: Lang;
}) {
  const { hero } = featured.row;
  const grade = hero.rank?.trim();
  return (
    <div
      className={cn(shareWellClass, 'grid', 'min-w-0', 'content-start', 'justify-items-center', 'gap-2', 'p-3', 'text-center')}
      data-testid={`share-card-featured-${featured.row.id}`}
    >
      <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">{featured.medal}</p>
      <HeroAvatar skin={hero.skin ?? 0} rarityIdx={rarityIndexOf(hero)} size="xl" className="w-18" name={hero.name} />
      <p className="m-0 flex max-w-full min-w-0 items-baseline justify-center gap-1.5">
        <span className="truncate text-[15px] leading-tight font-bold text-ink">{hero.name}</span>
        <ShareStars stars={hero.stars} />
      </p>
      <p className="m-0 font-mono text-[22px] leading-none font-bold tabular-nums text-accent">
        {hero.power == null ? NOT_PLACED : formatCompactNumber(hero.power, lang)}
      </p>
      <ShareDpsLine dps={featured.dps} copy={copy} lang={lang} heroId={featured.row.id} className="-mt-1 text-xs" />
      <p className="m-0 flex min-w-0 items-center justify-center gap-1.5">
        {grade ? (
          <BirthGradeLetter grade={grade} copy={showcaseCopyFor(lang)} testId="share-card-grade" />
        ) : null}
        <RarityLevel hero={hero} copy={copy} lang={lang} />
      </p>
      <ShareAbilityIcons
        abilities={hero.abilities}
        tileClassName={FEATURED_ABILITY_TILE}
        gapPx={FEATURED_ABILITY_GAP_PX}
        showLevels={show.showLevels}
      />
      {show.showGear ? <ShareGearGrid loadout={hero.loadout} showLevels={show.showLevels} /> : null}
    </div>
  );
}

export function ShareDpsLine({
  dps,
  copy,
  lang,
  heroId,
  className,
}: {
  dps: number | undefined;
  copy: ShareCardCopy;
  lang: Lang;
  heroId: string;
  className?: string;
}) {
  const [before, after] = copy.dps.split('{dps}');
  return (
    <p className={cn('m-0', 'whitespace-nowrap', 'text-muted', className)}>
      {before}
      <span className="font-mono tabular-nums text-ink" data-testid={`share-card-dps-${heroId}`}>
        {shareDpsText(dps, lang)}
      </span>
      {after}
    </p>
  );
}

function ShareGearGrid({ loadout, showLevels }: { loadout: HeroRecord['loadout']; showLevels: boolean }) {
  return (
    <div className="@container w-full" style={FEATURED_GEAR_TILE_STYLE}>
      <div className="grid grid-cols-4 gap-[3px]" data-testid="share-card-gear">
        {SLOTS.map((slot) => {
          const item = loadout[slot];
          return item ? (
            <ItemIcon key={slot} item={item} size="fluid" showLevel={showLevels} showUpgrade={showLevels} />
          ) : (
            <span
              key={slot}
              className={cn(artFrameRadiusClass, 'aspect-[18/19]', 'w-(--art-tile)', 'border', 'border-dashed', 'border-line')}
              aria-hidden
            />
          );
        })}
      </div>
    </div>
  );
}
