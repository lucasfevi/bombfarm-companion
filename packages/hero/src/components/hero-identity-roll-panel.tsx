'use client';

import { rarityLabel } from '@bombfarm/domain/game-labels';
import { MAX_STARS } from '@bombfarm/domain/gear';
import { RARITIES, type SheetKey } from '@bombfarm/domain/planner-constants';
import type { RollQualityReport } from '@bombfarm/domain/roll-quality';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { HeroAvatar, rarityTextClass } from '@bombfarm/game-art';
import {
  DataTable,
  Panel,
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
  identityFlagsFor,
  letterDisagreementFor,
  nextLetterReadout,
  railTintFor,
  statRollRowsFor,
  type FlagReading,
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
function GradeRailView({ mean }: { mean: number }) {
  const rail = gradeRailFor(mean);

  return (
    <div className="relative mt-1 h-6 w-full overflow-hidden border border-line bg-bg">
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
}: {
  hero: HeroRecord;
  rollQuality: RollQualityReport | undefined;
  t: HeroCopy;
  lang: Lang;
  statLabel: (key: SheetKey) => string;
}) {
  const availability = birthRollAvailability(hero, rollQuality);
  const placement = gradePlacementFor(rollQuality);
  const disagreement = letterDisagreementFor(rollQuality);
  const nextLetter = nextLetterReadout(rollQuality, (value) => formatNumber(value, lang, 1));
  const flags = identityFlagsFor(hero);
  const rows = statRollRowsFor(
    hero,
    (value) => formatNumber(value, lang, 2),
    (value) => `${formatNumber(value, lang, 1)}%`,
  );

  const rarityIndex = RARITIES.indexOf(hero.rarity);
  const marketableLabel: Record<FlagReading, string> = {
    yes: t.heroDetailIdentityMarketable,
    no: t.heroDetailIdentityNotMarketable,
    unknown: UNKNOWN,
  };
  const placementNoteKey = placement === undefined ? null : PLACEMENT_NOTE[placement.certainty.kind];

  return (
    <Panel className="min-w-0">
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.heroDetailIdentityTitle}</h2>
      </div>

      <div className="flex items-center gap-3">
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
          <p className={cn('mt-1 text-[11px] leading-none text-muted', numericClass)}>
            {'★'.repeat(Math.max(0, Math.min(MAX_STARS, Math.round(hero.stars))))}
          </p>
        </div>
      </div>

      <StatList
        className="mt-3"
        items={[
          { id: 'rarity', label: t.heroDetailIdentityRarity, value: rarityLabel(hero.rarity, lang) },
          {
            id: 'grade',
            label: t.heroDetailIdentityGrade,
            value: <span className={numericClass}>{hero.rank ?? UNKNOWN}</span>,
          },
          {
            id: 'level',
            label: t.heroDetailIdentityLevel,
            value: <span className={numericClass}>{formatNumber(hero.level, lang, 0)}</span>,
          },
          {
            id: 'stars',
            label: t.heroDetailIdentityStars,
            value: <span className={numericClass}>{formatNumber(hero.stars, lang, 0)}</span>,
          },
          {
            id: 'deployed',
            label: t.heroDetailIdentityDeployed,
            value: flags.deployed
              ? t.heroDetailIdentityDeployed
              : t.heroDetailIdentityNotDeployed,
          },
          {
            id: 'allowed',
            label: t.heroDetailIdentityAllowed,
            value: flags.battleAllowed
              ? t.heroDetailIdentityAllowed
              : t.heroDetailIdentityNotAllowed,
          },
          {
            id: 'marketable',
            label: t.heroDetailIdentityMarketable,
            value: marketableLabel[flags.marketable],
          },
        ]}
      />

      <h3 className={cn(sectionTitleClass, 'mt-4')}>{t.heroDetailRollTitle}</h3>
      <p className={tipClass}>{t.heroDetailRollPermanent}</p>

      {availability.kind === 'unavailable' ? (
        <p className={tipClass}>{t[UNAVAILABLE_NOTE[availability.reason]]}</p>
      ) : null}

      {placement === undefined ? null : (
        <>
          <StatList
            className="mt-2"
            items={[
              {
                id: 'quality',
                label: t.heroDetailRollQuality,
                value: (
                  <span className={numericClass}>{formatNumber(placement.mean, lang, 1)}</span>
                ),
              },
            ]}
          />

          <DataTable.Root className="mt-2 border border-line">
            <DataTable.Table>
              <DataTable.Head>
                <DataTable.Row>
                  <DataTable.Header scope="col">{t.heroDetailRollColStat}</DataTable.Header>
                  <DataTable.Header scope="col" align="right">
                    {t.heroDetailRollValue}
                  </DataTable.Header>
                  <DataTable.Header scope="col" align="right">
                    {t.heroDetailRollColBand}
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
                      {row.value}
                    </DataTable.Cell>
                    <DataTable.Cell align="right" numeric>
                      {row.band}
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
          <p className={tipClass}>{t.heroDetailRollTintIsOurs}</p>

          <h3 className={cn(sectionTitleClass, 'mt-4')}>
            {sub(t.heroDetailRollGradePlacement, { letter: placement.railLetter })}
          </h3>
          <GradeRailView mean={placement.mean} />
          {placementNoteKey === null ? null : <p className={tipClass}>{t[placementNoteKey]}</p>}
          <p className={tipClass}>
            {nextLetter === undefined
              ? t.heroDetailRollTopGrade
              : sub(t.heroDetailRollToNextLetter, {
                  range: nextLetter.range,
                  letter: nextLetter.letter,
                })}
          </p>

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
        </>
      )}
    </Panel>
  );
}
