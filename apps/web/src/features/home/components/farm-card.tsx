'use client';

import { formatPhaseCoord } from '@bombfarm/domain/phase-wiki';
import { Tooltip, formatNumber } from '@bombfarm/ui';
import { useAppLang } from '@/shared/context/app-lang';
import { sub, type Strings } from '@/shared/i18n';
import { selectFarmReturnBonus, usePlannerStore, type PlannerStore } from '@/shared/stores';
import { selectFarmCardRows, type FarmOutlookTile } from '../model/farm-card-view';
import { buildFarmSentence } from '../model/farm-sentence';
import { selectAccountUsable, selectHasRoster } from '../model/home-selectors';
import { FarmComparisonTable, type FarmComparisonColumn } from './farm-comparison-table';
import { HomeSectionCard } from './home-section-card';

const RETURN_BONUS_KEY = {
  off: 'farmRankingReturnBonusOff',
  on: 'farmRankingReturnBonusOn',
  vip: 'farmRankingReturnBonusVip',
} as const satisfies Record<PlannerStore['farmReturnBonus'], keyof Strings>;

function lockLine(tile: FarmOutlookTile, strings: Strings, phase: string): string | null {
  if (!tile.row.locked) return null;
  if (tile.block === null) return sub(strings.homeCardFarmLockedReach, { phase });
  const key = tile.block.gateInfeasible ? strings.homeCardFarmLockedGateCannot : strings.homeCardFarmLockedGate;
  return sub(key, { phase, gate: tile.block.gate });
}

export function FarmCard() {
  const { t, lang } = useAppLang();
  const view = usePlannerStore(selectFarmCardRows);
  const hasRoster = usePlannerStore(selectHasRoster);
  const accountUsable = usePlannerStore(selectAccountUsable);
  const returnBonus = usePlannerStore(selectFarmReturnBonus);
  const { currentRow, bestRow, pushTargetRow, nextItemLevel, nextDifficulty } = view;
  const ready = hasRoster && accountUsable && currentRow != null && bestRow != null;

  const pushLine =
    pushTargetRow && bestRow
      ? sub(t.homeCardFarmFooterPush, {
          phase: pushTargetRow.phase,
          pct: formatNumber(((pushTargetRow.goldPerHour - bestRow.goldPerHour) / bestRow.goldPerHour) * 100, lang, 1),
        })
      : null;

  let columns: FarmComparisonColumn[] = [];
  const notes: string[] = [];
  if (currentRow && bestRow) {
    const sentence = buildFarmSentence(view.sentence, t);
    if (sentence) notes.push(sub(t.homeCardFarmSentenceLead, { phase: t.homeCardFarmBest, rest: sentence.slice(0, -1) }) + '.');
    columns = [
      { id: 'current', title: t.homeCardFarmCurrent, row: currentRow, vs: 'here' },
      {
        id: 'best',
        title: t.homeCardFarmBest,
        row: bestRow,
        vs: view.pill.pct == null ? 'same' : { pct: view.pill.pct, tone: view.pill.tone, against: t.homeCardFarmVsCurrent },
      },
    ];
    for (const [columnId, next, against] of [
      ['nextItemLevel', nextItemLevel, t.homeCardFarmVsBest],
      ['nextDifficulty', nextDifficulty, t.homeCardFarmVsCurrent],
    ] as const) {
      if (next?.kind !== 'tile') continue;
      columns.push({
        id: columnId,
        title: columnId === 'nextItemLevel' ? t.homeCardFarmNextItemLevel : t.homeCardFarmNextDifficulty,
        row: next.tile.row,
        vs: { pct: next.tile.pct, tone: next.tile.tone, against },
      });
      const line = lockLine(next.tile, t, formatPhaseCoord(next.tile.row.phase, lang));
      if (line) notes.push(line);
    }
  }
  const peak = Math.max(0, ...columns.map((column) => column.row.goldPerHour));

  return (
    <HomeSectionCard
      section="farm"
      state={ready ? 'ready' : 'needs'}
      context={t.homeCardFarmContext}
      footer={
        ready ? (
          <>
            <p className="m-0">{t.homeCardFarmFooterRanked}</p>
            {pushLine ? <p className="m-0">{pushLine}</p> : null}
            <p className="m-0">
              {t.farmRankingReturnBonusLabel} {t[RETURN_BONUS_KEY[returnBonus]]}
            </p>
          </>
        ) : (
          t.homeCardFarmNeeds
        )
      }
    >
      {columns.length > 0 ? (
        <Tooltip.Provider delay={200} closeDelay={80}>
          <FarmComparisonTable columns={columns} peakGoldPerHour={peak} sameLabel={t.homeCardFarmSame} />
          {notes.length > 0 ? (
            <div className="mt-3 mb-3 grid gap-1 border-t border-[color-mix(in_oklch,var(--line)_60%,transparent)] pt-2.5 text-xs leading-normal text-muted">
              {notes.map((note) => (
                <p key={note} className="m-0" data-testid="home-farm-note">
                  {note}
                </p>
              ))}
            </div>
          ) : null}
        </Tooltip.Provider>
      ) : null}
    </HomeSectionCard>
  );
}
