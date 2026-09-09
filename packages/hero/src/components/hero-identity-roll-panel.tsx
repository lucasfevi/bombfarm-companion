'use client';

import { rarityLabel } from '@bombfarm/domain/game-labels';
import { MAX_STARS } from '@bombfarm/domain/gear';
import { RARITIES, type SheetKey } from '@bombfarm/domain/planner-constants';
import type { RollQualityReport } from '@bombfarm/domain/roll-quality';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import {
  HeroAvatar,
  heroRankSoftBgClass,
  heroRankTextClass,
  rarityTextClass,
} from '@bombfarm/game-art';
import {
  DataTable,
  Panel,
  Tooltip,
  StatList,
  cn,
  formatNumber,
  panelHClass,
  panelTitleClass,
  tipClass,
} from '@bombfarm/ui';
import { sub, type HeroCopy, type HeroCopyKey, type Lang } from '../copy';
import type { PanelUnavailableReason } from '../core';
import {
  birthRollAvailability,
  gradePlacementFor,
  gradeRailFor,
  heroPowerTextFor,
  marketTileReadingFor,
  marketableReadingFor,
  letterDisagreementFor,
  railTintFor,
  statRollRowsFor,
  type HeroMarketPrice,
  type PlacementCertainty,
  type RollTint,
} from '../model';

const UNKNOWN = '—';

const sectionTitleClass = 'text-[10px] font-bold tracking-[0.08em] text-muted uppercase';

/** Every numeric column here is a column players compare down, and the sans face this app ships
 *  has no tabular figures — so the mono face is what actually keeps the digits in line. */
const numericClass = 'font-mono tabular-nums';

const TINT_CLASS: Record<RollTint, string> = {
  low: 'bg-down',
  mid: 'bg-warn',
  high: 'bg-up',
};

const PLACEMENT_NOTE: Record<PlacementCertainty['kind'], HeroCopyKey | null> = {
  settled: null,
  nearBoundary: 'heroDetailRollNearEdge',
  uncertain: 'heroDetailRollPlacementUncertain',
};

const UNAVAILABLE_NOTE: Record<PanelUnavailableReason, HeroCopyKey> = {
  noBirthRoll: 'heroDetailRollNoBirthRoll',
  noRollBounds: 'heroDetailRollNoBounds',
  noAbilities: 'heroDetailAbilitiesNone',
};

type IdentityFact = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly valueClass?: string | undefined;
  /** Shown on hover and focus. For a figure this app derives rather than reads off the save, so a
   *  player can tell what it is a measure of before trusting it. */
  readonly note?: string | undefined;
};

function FactTile({ fact }: { fact: IdentityFact }) {
  const tile = (
    <div className="min-w-0 border border-line px-2.5 py-1.5">
      <p className={sectionTitleClass}>{fact.label}</p>
      <p
        className={cn(
          numericClass,
          'mt-1 truncate text-sm leading-none font-bold',
          fact.valueClass ?? 'text-ink',
        )}
      >
        {fact.value}
      </p>
    </div>
  );

  if (fact.note === undefined) return tile;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={tile} />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>
            <p className="m-0 max-w-[36ch]">{fact.note}</p>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function RollRail({ percentile }: { percentile: number }) {
  return (
    <span className="mt-1 block h-1 w-full overflow-hidden bg-bg" aria-hidden="true">
      <span
        className={cn('block h-full', TINT_CLASS[railTintFor(percentile)])}
        style={{ width: `${percentile}%` }}
      />
    </span>
  );
}

/**
 * The rail is drawn from `LETTER_BANDS`' own cut points, so a letter's share of the width is its
 * share of the measured scale. Each boundary is painted as a band rather than a line because that
 * is the shape of the evidence — the corpus locates it inside an interval and no closer.
 */
function GradeRailView({ mean, railLetter }: { mean: number; railLetter: string }) {
  const rail = gradeRailFor(mean);

  return (
    <div
      className={cn(
        'relative mt-1 h-6 w-full overflow-hidden border border-line bg-bg',
        heroRankSoftBgClass(railLetter),
      )}
    >
      {rail.segments.map((segment) => (
        <span
          key={segment.letter}
          className="absolute inset-y-0 flex items-center justify-center border-l border-line text-[10px] font-bold text-muted first:border-l-0"
          style={{ left: `${segment.startPct}%`, width: `${segment.endPct - segment.startPct}%` }}
        >
          {segment.letter}
        </span>
      ))}
      {rail.boundaries.map((boundary) => (
        <span
          key={`${boundary.below}${boundary.above}`}
          aria-hidden="true"
          className="absolute inset-y-0 bg-warn/25"
          style={{ left: `${boundary.startPct}%`, width: `${boundary.endPct - boundary.startPct}%` }}
        />
      ))}
      <span
        className="absolute inset-y-0 w-0.5 bg-accent"
        style={{ left: `${rail.markerPct}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * Who a hero is, and how lucky its birth roll was — the one panel that tells two heroes of the
 * same grade apart.
 *
 * Every judgement it prints is made by an exported function in `../model` and proved there; this
 * file only arranges the results. It takes `t`/`lang` as props rather than reading
 * `useHeroCopy()`: that context carries the host-supplied `HeroPanelCopy`, and none of the roll
 * vocabulary below is a string a host already owns.
 */
export function HeroIdentityRollPanel({
  hero,
  rollQuality,
  t,
  lang,
  statLabel,
  marketPrice,
  formatAmount,
}: {
  hero: HeroRecord;
  rollQuality: RollQualityReport | undefined;
  t: HeroCopy;
  lang: Lang;
  statLabel: (key: SheetKey) => string;
  /** What the host resolved this hero to on the market, when it has a snapshot to resolve against. */
  marketPrice?: HeroMarketPrice | null | undefined;
  /** The host's own money formatting — this package prints no currency of its own. */
  formatAmount?: ((value: number, currency: string) => string) | undefined;
}) {
  const availability = birthRollAvailability(hero, rollQuality);
  const placement = gradePlacementFor(rollQuality);
  const disagreement = letterDisagreementFor(rollQuality);
  const marketable = marketableReadingFor(hero);
  const marketTile = marketTileReadingFor(marketable, marketPrice);
  const rows = statRollRowsFor(
    hero,
    (value) => formatNumber(value, lang, 2),
    (value) => `${formatNumber(value, lang, 1)}%`,
  );

  const rarityIndex = RARITIES.indexOf(hero.rarity);
  const starCount = Math.max(0, Math.min(MAX_STARS, Math.round(hero.stars)));
  const marketTileValue =
    marketTile.kind === 'value' && formatAmount !== undefined
      ? formatAmount(marketTile.amount, marketTile.currency)
      : t.heroDetailIdentityNotMarketable;
  const placementNoteKey = placement === undefined ? null : PLACEMENT_NOTE[placement.certainty.kind];

  const facts: readonly IdentityFact[] = [
    {
      id: 'rarity',
      label: t.heroDetailIdentityRarity,
      value: rarityLabel(hero.rarity, lang),
      valueClass: rarityTextClass(rarityIndex),
    },
    {
      // Painted in the colour the game paints this grade, so the letter reads the same here as on
      // the hero's own card.
      id: 'grade',
      label: t.heroDetailIdentityGrade,
      value: hero.rank ?? UNKNOWN,
      valueClass: heroRankTextClass(hero.rank),
    },
    { id: 'level', label: t.heroDetailIdentityLevel, value: formatNumber(hero.level, lang, 0) },
    {
      id: 'power',
      label: t.heroDetailIdentityPower,
      value: heroPowerTextFor(hero, (value) => formatNumber(value, lang, 0)),
    },
    ...(placement === undefined
      ? []
      : [
          {
            id: 'quality',
            label: t.heroDetailRollQuality,
            value: formatNumber(placement.mean, lang, 1),
            note: t.heroDetailRollQualityNote,
          },
        ]),
    {
      id: 'market',
      label: t.heroDetailIdentityMarketValue,
      value: marketTileValue,
      ...(marketTile.kind === 'value' ? { valueClass: 'text-up' } : {}),
    },
  ];

  return (
    <Panel className="min-w-0">
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.heroDetailIdentityTitle}</h2>
      </div>

      {/* How many facts sit on a row is decided by the panel's own width, not the viewport's:
          this panel sits in a detail column on one host and inside a tab strip on the other, and
          a wide window says nothing about the room it actually has. The rail and the table then
          run the full width — the rail's boundaries are intervals, and only at full width do they
          read as intervals rather than lines. */}
      <div className="@container">
        <div className="flex flex-col gap-3 @min-[40rem]:flex-row @min-[40rem]:items-center">
          <div className="flex shrink-0 items-center gap-3 @min-[40rem]:w-56">
            <HeroAvatar
              skin={hero.skin ?? 0}
              rarityIdx={rarityIndex}
              size="lg"
              name={hero.name}
              className="shrink-0"
            />
            <div className="min-w-0">
              <p
                className={cn(
                  'truncate text-base leading-none font-bold',
                  rarityTextClass(rarityIndex) ?? 'text-ink',
                )}
              >
                {hero.name}
              </p>
              {starCount > 0 ? (
                <p
                  className="mt-1 text-[11px] leading-none text-rar-4"
                  aria-label={formatNumber(starCount, lang, 0)}
                >
                  {'★'.repeat(starCount)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 @min-[30rem]:grid-cols-3 @min-[52rem]:grid-cols-4 @min-[72rem]:grid-cols-6">
            {facts.map((fact) => (
              <FactTile key={fact.id} fact={fact} />
            ))}
          </div>
        </div>

        <h3 className={cn(sectionTitleClass, 'mt-5')}>{t.heroDetailRollTitle}</h3>
        <p className={cn(tipClass, 'mt-1.5')}>{t.heroDetailRollPermanent}</p>

        {availability.kind === 'unavailable' ? (
          <p className={tipClass}>{t[UNAVAILABLE_NOTE[availability.reason]]}</p>
        ) : null}

        {placement === undefined ? null : (
          <>
            <h3 className={cn(sectionTitleClass, 'mt-4')}>
              {sub(t.heroDetailRollGradePlacement, { letter: placement.railLetter })}
            </h3>
            <GradeRailView mean={placement.mean} railLetter={placement.railLetter} />
            {placementNoteKey === null ? null : <p className={tipClass}>{t[placementNoteKey]}</p>}

            {disagreement === undefined ? null : (
              <>
                <p className={tipClass}>{t.heroDetailRollComputedDisagrees}</p>
                <p className={tipClass}>{t.heroDetailRollStoredLetterStands}</p>
                <StatList
                  className="mt-1"
                  items={[
                    {
                      id: 'stored',
                      label: t.heroDetailRollStoredLetter,
                      value: <span className={numericClass}>{disagreement.storedLetter}</span>,
                    },
                    {
                      id: 'computed',
                      label: t.heroDetailRollComputedLetter,
                      value: <span className={numericClass}>{disagreement.computedLetter}</span>,
                    },
                  ]}
                />
              </>
            )}

            <DataTable.Root className="mt-4 border border-line">
              <DataTable.Table>
                <DataTable.Head>
                  <DataTable.Row>
                    <DataTable.Header scope="col">{t.heroDetailRollColStat}</DataTable.Header>
                    <DataTable.Header scope="col" align="right">
                      {t.heroDetailRollColBand}
                    </DataTable.Header>
                    <DataTable.Header scope="col" align="right">
                      {t.heroDetailRollValue}
                    </DataTable.Header>
                    <DataTable.Header scope="col" align="right">
                      {t.heroDetailRollColPosition}
                    </DataTable.Header>
                  </DataTable.Row>
                </DataTable.Head>
                <DataTable.Body>
                  {rows.map((row) => (
                    <DataTable.Row key={row.key}>
                      <DataTable.Cell>{statLabel(row.key)}</DataTable.Cell>
                      <DataTable.Cell align="right" numeric>
                        {row.band}
                      </DataTable.Cell>
                      <DataTable.Cell align="right" numeric>
                        {row.value}
                      </DataTable.Cell>
                      <DataTable.Cell
                        align="right"
                        numeric
                        className={row.outOfBand ? 'text-warn' : undefined}
                      >
                        {row.position}
                        {row.percentile === undefined ? null : (
                          <RollRail percentile={row.percentile} />
                        )}
                      </DataTable.Cell>
                    </DataTable.Row>
                  ))}
                </DataTable.Body>
              </DataTable.Table>
            </DataTable.Root>
          </>
        )}
      </div>
    </Panel>
  );
}
