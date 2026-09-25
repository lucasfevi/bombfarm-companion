'use client';

/**
 * The account at a glance, above the roster in either presentation: the squad's power and its
 * three strongest heroes, the roster's size and rarity mix, the furthest phase, and how well the
 * squad is geared.
 *
 * Computed from the whole roster, never the toolbar's narrowed view — a filter is a question about
 * which heroes to look at, not about what the account holds.
 */
import { useMemo, type ReactNode } from 'react';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import { HeroAvatar, rarityDotClass } from '@bombfarm/game-art';
import { Panel, cn, formatCompactNumber, formatNumber } from '@bombfarm/ui';
import { showcaseCopyFor, sub, type Lang, type ShowcaseCopy } from '../../copy';
import { rosterSummaryFor, squadGearAveragesText, type RosterHeroRow, type RosterSummary } from '../../model';

/** Below the wide breakpoint the power cell takes its own row and the rest share the next one, so
 *  no cell ever wraps under a neighbour it has nothing to do with. */
const REST_COLUMNS: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
};
const WIDE_COLUMNS: Record<number, string> = {
  1: 'lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]',
  2: 'lg:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))]',
  3: 'lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]',
};

const eyebrowClass = 'm-0 text-[10px] font-bold tracking-[0.08em] text-muted uppercase';
const figureClass = 'm-0 mt-1 font-mono text-[22px] leading-tight font-semibold tabular-nums text-ink';
/** A figure with words in it reads in the sans face; the mono face spaces its letters apart. */
const wordedFigureClass = 'm-0 mt-1 text-[20px] leading-tight font-semibold tabular-nums text-ink';

export function RosterSummaryStrip({
  rows,
  maxPhase,
  onSelectHeroId,
  lang,
}: {
  /** The whole roster, before the toolbar narrows it. */
  rows: readonly RosterHeroRow[];
  /** The host's own reading; absent or `null`, the cell is left out rather than printed as a dash. */
  maxPhase?: number | null | undefined;
  onSelectHeroId: (heroId: string) => void;
  lang: Lang;
}) {
  const copy = showcaseCopyFor(lang);
  const summary = useMemo(() => rosterSummaryFor(rows, { maxPhase }), [rows, maxPhase]);
  const heroesById = useMemo(() => new Map(rows.map((row) => [row.id, row.hero])), [rows]);
  const gearText = squadGearAveragesText(summary.squadGear, copy, lang);

  const rest: ReactNode[] = [
    <HeroCountsCell key="heroes" summary={summary} copy={copy} lang={lang} />,
  ];
  if (summary.maxPhase !== undefined) {
    rest.push(
      <SummaryCell key="phase" testId="roster-summary-max-phase">
        <p className={eyebrowClass}>{copy.summaryMaxPhase}</p>
        <p className={figureClass}>{formatNumber(summary.maxPhase, lang, 0)}</p>
      </SummaryCell>,
    );
  }
  if (gearText !== undefined) {
    rest.push(
      <SummaryCell key="gear" testId="roster-summary-gear">
        <p className={eyebrowClass}>{copy.summarySquadGear}</p>
        <p className={wordedFigureClass}>{gearText}</p>
        <p className="m-0 mt-1 text-[11px] text-muted">
          {sub(copy.summaryGearItems, { count: summary.squadGear.itemCount })}
        </p>
      </SummaryCell>,
    );
  }

  return (
    <Panel
      className={cn(
        'grid',
        'gap-px',
        'overflow-hidden',
        'bg-line',
        'p-0',
        'grid-cols-1',
        REST_COLUMNS[rest.length],
        WIDE_COLUMNS[rest.length],
      )}
      aria-label={copy.summaryTitle}
      data-testid="roster-summary-strip"
    >
      <SummaryCell testId="roster-summary-power" className={cn('sm:col-span-full', 'lg:col-span-1')}>
        <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2">
          <div>
            <p className={eyebrowClass}>{copy.summarySquadPower}</p>
            <p className={figureClass}>{formatCompactNumber(summary.squadPower, lang)}</p>
          </div>
          <ol
            className="m-0 flex max-w-60 min-w-0 flex-1 list-none flex-col gap-0.5 p-0"
            aria-label={copy.summaryTopHeroes}
          >
            {summary.topSquadHeroes.map((top) => (
              <li key={top.id}>
                <TopHeroButton
                  hero={heroesById.get(top.id)}
                  name={top.name}
                  power={formatCompactNumber(top.power, lang)}
                  onSelect={() => {
                    onSelectHeroId(top.id);
                  }}
                  testId={`roster-summary-top-${top.id}`}
                />
              </li>
            ))}
          </ol>
        </div>
      </SummaryCell>
      {rest}
    </Panel>
  );
}

function SummaryCell({
  testId,
  className,
  children,
}: {
  testId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('min-w-0', 'bg-surface', 'px-4', 'py-3', className)} data-testid={testId}>
      {children}
    </div>
  );
}

function TopHeroButton({
  hero,
  name,
  power,
  onSelect,
  testId,
}: {
  hero: HeroRecord | undefined;
  name: string;
  power: string;
  onSelect: () => void;
  testId: string;
}) {
  const rarityIdx = hero === undefined ? -1 : RARITIES.indexOf(hero.rarity);
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={testId}
      className="grid w-full cursor-pointer grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 rounded-sm border-0 bg-transparent px-1 py-0.5 text-left text-xs text-ink hover:bg-bg focus-visible:[outline:2px_solid_var(--accent)]"
    >
      <span aria-hidden className="inline-flex">
        <HeroAvatar skin={hero?.skin ?? 0} rarityIdx={Math.max(0, rarityIdx)} size="xs" name={name} />
      </span>
      <span className="truncate">{name}</span>
      <span className="font-mono tabular-nums text-muted">{power}</span>
    </button>
  );
}

function HeroCountsCell({ summary, copy, lang }: { summary: RosterSummary; copy: ShowcaseCopy; lang: Lang }) {
  const entries = summary.rarityCounts.map((entry) => ({
    ...entry,
    dotClass: rarityDotClass(RARITIES.indexOf(entry.rarity)),
    text: sub(copy.summaryRarityEntry, { count: entry.count, rarity: rarityLabel(entry.rarity, lang) }),
  }));
  return (
    <SummaryCell testId="roster-summary-heroes">
      <p className={eyebrowClass}>{copy.summaryHeroes}</p>
      <p className="m-0 mt-1 text-[15px] leading-tight font-semibold text-ink">
        {sub(copy.summarySquadCount, { count: summary.squadCount })}
        <span className="text-muted" aria-hidden>
          {' · '}
        </span>
        {sub(copy.summaryBenchCount, { count: summary.benchCount })}
      </p>
      <div
        className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={`${copy.summaryRarityMix}: ${entries.map((entry) => entry.text).join(', ')}`}
      >
        {entries.map((entry) => (
          <span
            key={entry.rarity}
            className={cn('block', entry.dotClass)}
            style={{ flexGrow: entry.count, flexBasis: 0 }}
          />
        ))}
      </div>
      <ul
        className="m-0 mt-1.5 flex list-none flex-wrap gap-x-2.5 gap-y-0.5 p-0 text-[11px] text-muted"
        data-testid="roster-summary-rarity-legend"
      >
        {entries.map((entry) => (
          <li key={entry.rarity} className="inline-flex items-center gap-1">
            <span className={cn('inline-block', 'size-2', 'rounded-[2px]', entry.dotClass)} aria-hidden />
            {entry.text}
          </li>
        ))}
      </ul>
    </SummaryCell>
  );
}
