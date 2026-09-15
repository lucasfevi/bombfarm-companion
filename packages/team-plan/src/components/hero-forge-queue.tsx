'use client';

import { useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { formatItemRosterTooltip } from '@bombfarm/domain/game-labels';
import type { ForgeForecast } from '@bombfarm/domain/forge';
import { cn, formatCompactNumber, formatNumber, mutedClass } from '@bombfarm/ui';
import { ItemIcon } from '@bombfarm/game-art';
import { sub, type Lang } from '@bombfarm/hero/copy';
import type { TeamPlanScreenCopy } from '../copy';
import { buildForgeQueue, type ForgeLadderRung } from '../model/forge-queue';
import type { GearFlowRow } from '../model/gear-flow-rows';

/** One entry of a hero's forge queue, as a host's action sees it: the piece and the climb. */
export type ForgeQueueEntryRef = { itemId: string; from: number; to: number };

/** A host's control for one entry — the desktop's add-to-queue button. Absent on the web. */
export type ForgeQueueAction = (entry: ForgeQueueEntryRef) => ReactNode;

const rungClass: Record<ForgeLadderRung['kind'], string> = {
  held: 'bg-line',
  safe: 'bg-accent',
  roll: 'bg-[color-mix(in_oklch,var(--accent)_var(--chance),var(--line))]',
  beyond: 'border border-line/60 bg-transparent',
};

function Ladder({ rungs, label }: { rungs: ForgeLadderRung[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="flex h-2 items-stretch gap-px">
      {rungs.map((rung) => (
        <span
          key={rung.target}
          className={cn(
            'min-w-0 flex-1 rounded-[1px]',
            rungClass[rung.kind],
            // The safe line: the last rung a jump can reach sits a hair apart from the first roll.
            rung.target === 8 && 'mr-1',
          )}
          style={rung.kind === 'roll' ? ({ '--chance': `${Math.round(rung.chance * 100)}%` } as CSSProperties) : undefined}
        />
      ))}
    </div>
  );
}

function formatCount(value: number, lang: Lang): string {
  return formatNumber(value, lang, Number.isInteger(Math.round(value * 10) / 10) ? 0 : 1);
}

function forecastLine(t: TeamPlanScreenCopy, lang: Lang, forecast: ForgeForecast): string {
  const jumps = Math.round(forecast.safeJumps * 10) / 10;
  const parts = [sub(t.teamPlanForgeQueueRolls, { rolls: formatCount(forecast.rolls, lang) })];
  if (jumps === 1) parts.push(t.teamPlanForgeQueueSafeJumpOne);
  else if (jumps > 0) parts.push(sub(t.teamPlanForgeQueueSafeJumpMany, { count: formatCount(jumps, lang) }));
  parts.push(sub(t.teamPlanForgeQueueGold, { gold: formatCompactNumber(forecast.gold, lang, 1) }));
  return parts.join(' · ');
}

/**
 * Every forge chore among the hero's proposed items, each drawn as its ladder: the rungs it already
 * holds, the safe jump to +8, and each roll past it faded by its own chance. The figures are the
 * expected cost of climbing — rolls, safe jumps and gold — and the footer sums them.
 */
export function HeroForgeQueue({
  t,
  lang,
  rows,
  action,
}: {
  t: TeamPlanScreenCopy;
  lang: Lang;
  rows: readonly GearFlowRow[];
  action: ForgeQueueAction | undefined;
}) {
  const queue = useMemo(() => buildForgeQueue(rows), [rows]);
  if (queue.entries.length === 0) return null;

  return (
    <section className="rounded-sm border border-line bg-bg px-3 py-2.5" data-testid="team-plan-forge-queue">
      <h4 className="m-0 text-[11px] tracking-[0.03em] text-muted uppercase">{t.teamPlanForgeQueueHeading}</h4>
      <ul className="m-0 mt-2 flex list-none flex-col gap-2.5 p-0">
        {queue.entries.map(({ row, from, to, rungs, forecast }) => {
          const item = { defId: row.defId, rarityIdx: row.rarityIdx, level: row.level, upgrade: to };
          const tip = formatItemRosterTooltip(item, lang, t.rankLv);
          return (
            <li key={row.itemId} className="flex items-start gap-2.5" data-testid="team-plan-forge-queue-item">
              <ItemIcon item={item} size="sm" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-[12px] leading-tight font-bold text-ink">{tip.title}</span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink">
                    +{from} → +{to}
                  </span>
                </div>
                <Ladder rungs={rungs} label={sub(t.teamPlanForgeQueueLadderAria, { item: tip.title, from, to })} />
                <span className={mutedClass}>
                  {forecast ? forecastLine(t, lang, forecast) : t.teamPlanForgeQueueNoForecast}
                </span>
              </div>
              {action ? <div className="shrink-0 self-center">{action({ itemId: row.itemId, from, to })}</div> : null}
            </li>
          );
        })}
      </ul>
      {queue.total && queue.entries.length > 1 ? (
        <p className="m-0 mt-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-line/50 pt-2 text-[11px]">
          <span className="text-muted">{sub(t.teamPlanForgeQueueTotal, { count: queue.entries.length })}</span>
          <span className="font-semibold text-ink">{forecastLine(t, lang, queue.total)}</span>
        </p>
      ) : null}
      <p className={cn('m-0 mt-2 leading-snug', mutedClass)}>{t.teamPlanForgeQueueLegend}</p>
    </section>
  );
}
