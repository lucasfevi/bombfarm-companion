import { SLOTS, type EquippedItem } from '@bombfarm/domain/gear';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { HeroAvatar, ItemIcon, artFrameRadiusClass } from '@bombfarm/game-art';
import { cn, formatCompactNumber } from '@bombfarm/ui';
import { showcaseCopyFor, type Lang, type ShareCardCopy } from '../../copy';
import { shareDpsText, type RosterHeroRow } from '../../model';
import { BirthGradeChip } from '../roster-board/birth-grade-chip';
import { RarityLevel, ShareAbilityIcons, ShareStars, rarityIndexOf, shareWellClass } from './share-card-parts';

const NOT_PLACED = '—';

/** Six abilities have to sit on one line inside a third of the card. */
const FEATURED_ABILITY_TILE = 'size-[26px]';
const FEATURED_ABILITY_GAP_PX = 3;

export type ShareFeaturedHero = {
  readonly row: RosterHeroRow;
  readonly medal: string;
  readonly dps: number | undefined;
};

export function ShareFeaturedTile({
  featured,
  showGear,
  copy,
  lang,
}: {
  featured: ShareFeaturedHero;
  showGear: boolean;
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
      <p className="m-0 font-mono text-[22px] leading-none font-bold tabular-nums text-ink">
        {hero.power == null ? NOT_PLACED : formatCompactNumber(hero.power, lang)}
      </p>
      <ShareDpsLine dps={featured.dps} copy={copy} lang={lang} heroId={featured.row.id} className="-mt-1 text-xs" />
      <p className="m-0 flex min-w-0 items-center justify-center gap-1.5">
        {grade ? (
          <BirthGradeChip grade={grade} copy={showcaseCopyFor(lang)} testId="share-card-grade" />
        ) : null}
        <RarityLevel hero={hero} copy={copy} lang={lang} />
      </p>
      <ShareAbilityIcons abilities={hero.abilities} tileClassName={FEATURED_ABILITY_TILE} gapPx={FEATURED_ABILITY_GAP_PX} />
      {showGear ? <ShareGearGrid loadout={hero.loadout} /> : null}
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

function ShareGearGrid({ loadout }: { loadout: HeroRecord['loadout'] }) {
  return (
    <div className="grid grid-cols-[repeat(4,32px)] justify-center gap-[3px]" data-testid="share-card-gear">
      {SLOTS.map((slot) => {
        const item = loadout[slot];
        return item ? (
          <ShareGearTile key={slot} item={item} />
        ) : (
          <span
            key={slot}
            className={cn(artFrameRadiusClass, 'aspect-[18/19]', 'w-8', 'border', 'border-dashed', 'border-line')}
            aria-hidden
          />
        );
      })}
    </div>
  );
}

/** The item's level in one corner as the app prints it everywhere, and its forge in green in the
 *  opposite one — the pair a friend reads a piece of gear by. */
function ShareGearTile({ item }: { item: EquippedItem }) {
  const upgrade = Math.max(0, Math.round(item.upgrade));
  return (
    <span className="relative inline-flex">
      <ItemIcon item={item} size="sm" showUpgrade={false} />
      {upgrade > 0 ? (
        <span
          className="pointer-events-none absolute bottom-px left-0.5 z-2 font-mono text-[9px] leading-none font-semibold text-up [text-shadow:0_1px_1px_var(--bg),0_0_3px_var(--bg)]"
          aria-hidden
        >
          +{upgrade}
        </span>
      ) : null}
    </span>
  );
}
