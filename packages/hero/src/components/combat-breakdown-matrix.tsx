'use client';

import { Tooltip, cn } from '@bombfarm/ui';
import { sub, type HeroCopy, type StatPanelCopy } from '../copy';
import { SHEET_PCT_KEYS, ledgerStepText, sourceLabel } from '../model/breakdown-labels';
import { matrixShowsRunes, type MatrixCell, type MatrixRow } from '../model/combat-breakdown';

const headClass = 'px-2 py-1.5 text-right text-[9px] font-bold tracking-[0.08em] whitespace-nowrap text-muted uppercase';
const cellClass = 'px-2 py-1.5 text-right font-mono text-[12px] tabular-nums whitespace-nowrap';

function Cell({ cell, off, formatNumber }: { cell: MatrixCell; off: string; formatNumber: (n: number, d?: number) => string }) {
  switch (cell.kind) {
    case 'step':
      return <td className={cn(cellClass, cell.step.op === '×' && 'text-accent')}>{ledgerStepText(cell.step, formatNumber)}</td>;
    case 'off':
      return <td className={cn(cellClass, 'text-muted')} data-cell="off">{off}</td>;
    case 'none':
      return <td className={cn(cellClass, 'text-muted')} data-cell="none">—</td>;
  }
}

function HeroCell({
  row,
  t,
  copy,
  formatNumber,
}: {
  row: MatrixRow;
  t: StatPanelCopy;
  copy: HeroCopy;
  formatNumber: (n: number, d?: number) => string;
}) {
  return (
    <td className={cellClass}>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <span
              tabIndex={0}
              aria-label={sub(copy.heroDetailBreakdownHeroCellAria, { stat: t.statFull[row.key] })}
              className="cursor-help rounded-sm underline decoration-dotted decoration-line underline-offset-2 outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              {formatNumber(row.hero.value, 2)}
            </span>
          }
        />
        <Tooltip.Portal>
          <Tooltip.Positioner side="bottom" sideOffset={4}>
            <Tooltip.Popup>
              <ul className="m-0 list-none p-0 font-mono text-[11px] tabular-nums" data-testid="breakdown-hero-steps">
                {row.hero.steps.map((step, index) => (
                  <li key={`${step.source}-${index}`} className="flex justify-between gap-4">
                    <span className="font-sans text-muted">{sourceLabel(t, step.source)}</span>
                    <span>{ledgerStepText(step, formatNumber)}</span>
                  </li>
                ))}
              </ul>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </td>
  );
}

/**
 * All seven combat sheet stats, one row each, one column per game line, the aura after the
 * sheet total. Full-width because it is wide: eight or nine figures per row.
 */
export function CombatBreakdownMatrix({
  rows,
  t,
  copy,
  formatNumber,
}: {
  rows: readonly MatrixRow[];
  t: StatPanelCopy;
  copy: HeroCopy;
  formatNumber: (n: number, d?: number) => string;
}) {
  const runes = matrixShowsRunes(rows);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" data-testid="breakdown-matrix">
        <thead>
          <tr className="border-b border-line">
            <th className={cn(headClass, 'text-left')} scope="col">{copy.heroDetailBreakdownColStat}</th>
            <th className={headClass} scope="col">{copy.heroDetailBreakdownColHero}</th>
            <th className={headClass} scope="col">{copy.heroDetailBreakdownColGear}</th>
            <th className={headClass} scope="col">{copy.heroDetailBreakdownColAbility}</th>
            <th className={headClass} scope="col">{copy.heroDetailBreakdownColTree}</th>
            {runes ? <th className={headClass} scope="col">{copy.heroDetailBreakdownColRune}</th> : null}
            <th className={cn(headClass, 'border-l border-line')} scope="col">{copy.heroDetailBreakdownColSheetTotal}</th>
            <th className={headClass} scope="col">{copy.heroDetailBreakdownColAura}</th>
            <th className={headClass} scope="col">{copy.heroDetailBreakdownColEffective}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const unit = SHEET_PCT_KEYS.has(row.key) ? '%' : '';
            return (
              <tr key={row.key} className="border-b border-line last:border-b-0" data-matrix-row={row.key}>
                <th scope="row" className="px-2 py-1.5 text-left text-[12px] font-medium whitespace-nowrap text-ink">
                  {t.statFull[row.key]}
                </th>
                <HeroCell row={row} t={t} copy={copy} formatNumber={formatNumber} />
                <Cell cell={row.gear} off={copy.heroDetailBreakdownAuraOff} formatNumber={formatNumber} />
                <Cell cell={row.ability} off={copy.heroDetailBreakdownAuraOff} formatNumber={formatNumber} />
                <Cell cell={row.skillTree} off={copy.heroDetailBreakdownAuraOff} formatNumber={formatNumber} />
                {runes ? <Cell cell={row.rune} off={copy.heroDetailBreakdownAuraOff} formatNumber={formatNumber} /> : null}
                <td className={cn(cellClass, 'border-l border-line font-semibold')}>
                  {formatNumber(row.sheetTotal, 2)}
                  {unit}
                </td>
                <Cell cell={row.aura} off={copy.heroDetailBreakdownAuraOff} formatNumber={formatNumber} />
                <td className={cn(cellClass, 'font-semibold text-ink')} data-testid="breakdown-effective">
                  {formatNumber(row.effective, 2)}
                  {unit}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
