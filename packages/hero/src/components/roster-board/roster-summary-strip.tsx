'use client';

/**
 * The account at a glance, above the roster in either presentation: the squad's power, the
 * roster's size and rarity mix, the furthest phase, and how well the squad is geared.
 *
 * Computed from the whole roster, never the toolbar's narrowed view — a filter is a question about
 * which heroes to look at, not about what the account holds.
 */
import { useMemo, type ReactNode } from 'react';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import { rarityDotClass } from '@bombfarm/game-art';
import { Panel, cn, formatCompactNumber, formatNumber } from '@bombfarm/ui';
import { showcaseCopyFor, sub, type Lang, type ShowcaseCopy } from '../../copy';
import { rosterSummaryFor, squadGearAveragesText, type RosterHeroRow, type RosterSummary } from '../../model';

/** Two to a row below the wide breakpoint, then every cell on one row. */
const WIDE_COLUMNS: Record<number, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
};

const eyebrowClass = 'm-0 text-[10px] font-bold tracking-[0.08em] text-muted uppercase';
const figureClass = 'm-0 mt-1 font-mono text-[22px] leading-tight font-semibold tabular-nums text-ink';
const headlineFigureClass = 'm-0 mt-1 font-mono text-[34px] leading-none font-bold tabular-nums text-ink';
/** A figure with words in it reads in the sans face; the mono face spaces its letters apart. */
const wordedFigureClass = 'm-0 mt-1 text-[20px] leading-tight font-semibold tabular-nums text-ink';

export function RosterSummaryStrip({
  rows,
  maxPhase,
  lang,
}: {
  /** The whole roster, before the toolbar narrows it. */
  rows: readonly RosterHeroRow[];
  /** The host's own reading; absent or `null`, the cell is left out rather than printed as a dash. */
  maxPhase?: number | null | undefined;
  lang: Lang;
}) {
  const copy = showcaseCopyFor(lang);
  const summary = useMemo(() => rosterSummaryFor(rows, { maxPhase }), [rows, maxPhase]);
  const gearText = squadGearAveragesText(summary.squadGear, copy, lang);

  const cells: ReactNode[] = [
    <SummaryCell key="power" testId="roster-summary-power">
      <p className={eyebrowClass}>{copy.summarySquadPower}</p>
      <p className={headlineFigureClass}>{formatCompactNumber(summary.squadPower, lang)}</p>
    </SummaryCell>,
    <HeroCountsCell key="heroes" summary={summary} copy={copy} lang={lang} />,
  ];
  if (summary.maxPhase !== undefined) {
    cells.push(
      <SummaryCell key="phase" testId="roster-summary-max-phase">
        <p className={eyebrowClass}>{copy.summaryMaxPhase}</p>
        <p className={figureClass}>{formatNumber(summary.maxPhase, lang, 0)}</p>
      </SummaryCell>,
    );
  }
  if (gearText !== undefined) {
    cells.push(
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
        'sm:grid-cols-2',
        WIDE_COLUMNS[cells.length],
      )}
      aria-label={copy.summaryTitle}
      data-testid="roster-summary-strip"
    >
      {cells}
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
    <div
      className={cn('min-w-0', 'bg-surface', 'px-4', 'py-3', 'sm:max-lg:odd:last:col-span-2', className)}
      data-testid={testId}
    >
      {children}
    </div>
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
