'use client';

import type { CollectionAxis } from '@bombfarm/contracts';
import type { CollectionAxisRow, CollectionBoard } from '@bombfarm/domain/model';
import { Bar, Chip, cn, Panel, PanelHeader, Tooltip } from '@bombfarm/ui';
import type { CollectionBonusFilter } from '../../lib/collections/collection-filters';
import { fillPercent, formatBonus, formatLimit } from '../../lib/collections/collections-format';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { axisLabel, axisTipLines, summaryLine } from './collections-labels';

const tileClass = cn(
  'flex min-w-0 cursor-pointer flex-col gap-1.5 border border-line bg-transparent px-2.5 py-2 text-left',
  'hover:border-[color-mix(in_oklch,var(--accent)_45%,var(--line))]',
  'aria-pressed:border-accent aria-pressed:bg-[color-mix(in_oklch,var(--accent)_10%,var(--surface))]',
  'focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
);

function AxisTile({
  row,
  pressed,
  onPress,
}: {
  row: CollectionAxisRow;
  pressed: boolean;
  onPress: (axis: CollectionAxis) => void;
}) {
  const t = useCopy();
  const { locale } = useLocale();
  const empty = row.total <= 0;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        type="button"
        aria-pressed={pressed}
        data-testid="collections-axis"
        data-axis={row.axis}
        data-at-cap={row.atCap ? 'true' : 'false'}
        data-empty={empty ? 'true' : 'false'}
        className={tileClass}
        onClick={() => {
          onPress(row.axis);
        }}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0 text-[10.5px] uppercase tracking-[0.06em] text-muted">{axisLabel(row.axis, t)}</span>
          {row.atCap ? (
            <Chip variant="small-active" className="ml-0 shrink-0" data-testid="collections-axis-at-cap">
              {t.collectionsAxisAtCap}
            </Chip>
          ) : null}
        </span>
        <span
          data-testid="collections-axis-total"
          className={cn('text-xl font-bold leading-none tabular-nums', empty ? 'text-muted' : 'text-ink')}
        >
          {formatBonus(row.total, locale)}
        </span>
        <Bar percent={fillPercent(row.total, row.cap)} variant={row.atCap ? 'best' : 'fill'} />
        <span data-testid="collections-axis-cap" className="text-[11px] text-muted tabular-nums">
          {sub(t.collectionsAxisCap, { cap: formatLimit(row.cap, locale) })}
        </span>
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
              <p className="m-0 text-muted">{t.collectionsAxisFilterHint}</p>
            </div>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
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
  const { locale } = useLocale();

  return (
    <Panel data-testid="collections-bonuses">
      <PanelHeader title={t.collectionsBonusesTitle} />
      <div className="flex flex-col gap-3">
        <p className="m-0 text-xs text-muted tabular-nums" data-testid="collections-summary">
          {summaryLine(board.summary, t, locale)}
        </p>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5" data-testid="collections-axes">
          {board.axes.map((row) => (
            <AxisTile key={row.axis} row={row} pressed={activeAxis === row.axis} onPress={onToggleAxis} />
          ))}
        </div>
      </div>
    </Panel>
  );
}
