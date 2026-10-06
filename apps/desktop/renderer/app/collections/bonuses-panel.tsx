'use client';

import type { CollectionAxis } from '@bombfarm/contracts';
import type { CollectionAxisRow, CollectionBoard } from '@bombfarm/domain/model';
import { Bar, Chip, cn, Panel, PanelHeader, Tooltip } from '@bombfarm/ui';
import type { CollectionBonusFilter } from '../../lib/collections/collection-filters';
import { axisColourStyle } from '../../lib/collections/collections-axis-colour';
import { fillPercent, formatBonus } from '../../lib/collections/collections-format';
import {
  axisSetEntries,
  fitSetNames,
  SET_LINE_SEPARATOR,
  type AxisSetEntry,
} from '../../lib/collections/collections-set-names';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { axisLabel, axisProgress, axisTileLabel, axisTipLines, summaryLine } from './collections-labels';

const tileClass = cn(
  'relative flex min-w-0 flex-col gap-1.5 border border-t-2 border-line border-t-[var(--axis-colour)] px-2.5 py-2',
  'hover:bg-[color-mix(in_oklch,var(--axis-colour)_6%,transparent)]',
  'has-[[aria-pressed=true]]:border-x-[var(--axis-colour)] has-[[aria-pressed=true]]:border-b-[var(--axis-colour)]',
  'has-[[aria-pressed=true]]:bg-[color-mix(in_oklch,var(--axis-colour)_12%,var(--surface))]',
  'has-[:focus-visible]:[outline-style:solid] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
);

/** The label is the tile's one button, stretched over the whole tile by its pseudo-element, so the
 *  bar and figures under it stay ordinary content rather than children of a button. */
const labelButtonClass = cn(
  'block w-full cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[10.5px] uppercase tracking-[0.06em] text-muted',
  "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none",
);

function SetLine({ entries }: { entries: readonly AxisSetEntry[] }) {
  const { shown, hidden } = fitSetNames(entries);
  return (
    <p data-testid="collections-axis-sets" className="m-0 min-h-[1rem] truncate text-[11px] leading-tight">
      {shown.map((entry, index) => (
        <span key={entry.name}>
          {index === 0 ? null : <span className="text-muted">{SET_LINE_SEPARATOR}</span>}
          <span className={entry.grants ? 'text-ink' : 'text-muted'} data-grants={entry.grants ? 'true' : 'false'}>
            {entry.name}
          </span>
        </span>
      ))}
      {hidden > 0 ? (
        <span className="text-muted" data-testid="collections-axis-sets-more">
          {SET_LINE_SEPARATOR}+{hidden}
        </span>
      ) : null}
    </p>
  );
}

function AxisTile({
  row,
  entries,
  pressed,
  onPress,
}: {
  row: CollectionAxisRow;
  entries: readonly AxisSetEntry[];
  pressed: boolean;
  onPress: (axis: CollectionAxis) => void;
}) {
  const t = useCopy();
  const { locale } = useLocale();
  const empty = row.total <= 0;

  return (
    <div
      data-testid="collections-axis"
      data-axis={row.axis}
      data-at-cap={row.atCap ? 'true' : 'false'}
      data-empty={empty ? 'true' : 'false'}
      style={axisColourStyle(row.axis)}
      className={tileClass}
    >
      <Tooltip.Root>
        <Tooltip.Trigger
          type="button"
          aria-pressed={pressed}
          aria-label={axisTileLabel(row, t, locale)}
          data-testid="collections-axis-button"
          className={labelButtonClass}
          onClick={() => {
            onPress(row.axis);
          }}
        >
          {axisLabel(row.axis, t)}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={6}>
            <Tooltip.Popup>
              <div className="flex max-w-72 flex-col gap-1 text-[11px] leading-snug">
                {axisTipLines(row, t, locale).map((line) => (
                  <p key={line} className="m-0">
                    {line}
                  </p>
                ))}
                {entries.length === 0 ? null : (
                  <p className="m-0" data-testid="collections-axis-sets-tip">
                    {sub(t.collectionsAxisSets, { names: entries.map((entry) => entry.name).join(SET_LINE_SEPARATOR) })}
                  </p>
                )}
                <p className="m-0 text-muted">{t.collectionsAxisFilterHint}</p>
              </div>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
      <div className="flex items-center justify-between gap-2">
        <span
          data-testid="collections-axis-total"
          className={cn('text-xl font-bold leading-none tabular-nums', empty ? 'text-muted' : 'text-[var(--axis-colour)]')}
        >
          {formatBonus(row.total, locale)}
        </span>
        {row.atCap ? (
          <Chip variant="small-active" className="ml-0 shrink-0" data-testid="collections-axis-at-cap">
            {t.collectionsAxisAtCap}
          </Chip>
        ) : null}
      </div>
      <Bar
        percent={fillPercent(row.total, row.cap)}
        className="bg-[var(--axis-colour)]"
      />
      <div className="flex items-baseline justify-between gap-2 text-[11px] text-muted tabular-nums" data-testid="collections-axis-cap">
        <span>{t.collectionsAxisToCap}</span>
        <span data-testid="collections-axis-progress">{axisProgress(row, t, locale)}</span>
      </div>
      <SetLine entries={entries} />
    </div>
  );
}

/** The account's bonus on each of the ten axes against that axis's cap, in the game's panel order.
 *  A tile is also a shortcut: pressing it lists only the books that grant that bonus. */
export function BonusesPanel({
  board,
  activeAxis,
  onToggleAxis,
}: {
  board: CollectionBoard;
  activeAxis: CollectionBonusFilter;
  onToggleAxis: (axis: CollectionAxis) => void;
}) {
  const t = useCopy();
  const { locale, lang } = useLocale();

  return (
    <Panel data-testid="collections-bonuses">
      <PanelHeader title={t.collectionsBonusesTitle} />
      <div className="flex flex-col gap-3">
        <p className="m-0 text-xs text-muted tabular-nums" data-testid="collections-summary">
          {summaryLine(board.summary, t, locale)}
        </p>
        <div className="grid grid-cols-5 gap-2" data-testid="collections-axes">
          {board.axes.map((row) => (
            <AxisTile
              key={row.axis}
              row={row}
              entries={axisSetEntries(row, board.sets, lang)}
              pressed={activeAxis === row.axis}
              onPress={onToggleAxis}
            />
          ))}
        </div>
      </div>
    </Panel>
  );
}
