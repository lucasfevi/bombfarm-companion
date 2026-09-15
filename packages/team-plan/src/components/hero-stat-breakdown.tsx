'use client';

import { gameSheetView } from '@bombfarm/domain/model';
import { SHEET_PANEL_KEYS } from '@bombfarm/domain/planner-constants';
import type { TeamPlanHeroStats } from '@bombfarm/domain/team-plan/types';
import { sheetStatUnit } from '@bombfarm/hero/model';
import { DeltaTable, type DeltaTableRow } from '@bombfarm/ui';
import type { TeamPlanScreenCopy } from '../copy';

type Copy = TeamPlanScreenCopy;

/** Ordered as the Planner's own sheet table, Luck right after Speed. Luck is display-only here —
 *  it never reaches DPS scoring. */
const SHEET_STAT_KEYS = SHEET_PANEL_KEYS as readonly (keyof TeamPlanHeroStats)[];

const subheadingClass = 'm-0 mb-1 text-[9px] font-bold leading-none tracking-[0.06em] text-muted uppercase';

function statRows(
  t: Copy,
  before: TeamPlanHeroStats,
  after: TeamPlanHeroStats,
  keys: readonly (keyof TeamPlanHeroStats)[],
): DeltaTableRow[] {
  return keys.map((key) => ({
    id: key,
    // The unit rides on the label here, not on the figure: `DeltaTable` formats its own numbers
    // from one shared decimals setting and has no per-row unit to hand them.
    label: `${t.statShort[key]}${sheetStatUnit(key) === '' ? '' : ` ${sheetStatUnit(key)}`}`,
    now: before[key],
    target: after[key],
  }));
}

/**
 * Sheet stats pass through `gameSheetView` so they match what the game's own hero panel shows
 * (100% crit chance / 80% CDR clamp). The hit rows below stay on the uncapped combat figures —
 * combat crit chance legitimately exceeds the sheet cap via Presságio Mortal and similar.
 */
function capSheetStats(stats: TeamPlanHeroStats): TeamPlanHeroStats {
  const viewed = gameSheetView(stats);
  return {
    attack: viewed.attack,
    energy: viewed.energy,
    speed: viewed.speed,
    critChance: viewed.critChance,
    critDmg: viewed.critDmg,
    penetration: viewed.penetration,
    cdr: viewed.cdr,
    luck: viewed.luck,
  };
}

/**
 * Normal hit before/after plus a Critical row derived at display time —
 * `hit × (1 + effective.critDmg / 100)`, the same formula `advisor-pipeline.ts` uses for
 * `predCrit`. No new domain field: `combatBefore`/`combatAfter` already carry `critDmg`
 * (combat-effective, uncapped — same basis `predictHitDamage`'s `hit` was computed against).
 */
function hitRows(
  t: Copy,
  hitBefore: number,
  hitAfter: number,
  combatBefore: TeamPlanHeroStats,
  combatAfter: TeamPlanHeroStats,
): DeltaTableRow[] {
  return [
    {
      id: 'hitNormal',
      label: t.teamPlanHeroHitNormal,
      now: hitBefore,
      target: hitAfter,
    },
    {
      id: 'hitCritical',
      label: t.teamPlanHeroHitCritical,
      now: hitBefore * (1 + combatBefore.critDmg / 100),
      target: hitAfter * (1 + combatAfter.critDmg / 100),
    },
  ];
}

export function HeroStatBreakdown({
  t,
  sheetBefore,
  sheetAfter,
  combatBefore,
  combatAfter,
  hitBefore,
  hitAfter,
}: {
  t: Copy;
  sheetBefore: TeamPlanHeroStats;
  sheetAfter: TeamPlanHeroStats;
  combatBefore: TeamPlanHeroStats;
  combatAfter: TeamPlanHeroStats;
  hitBefore: number;
  hitAfter: number;
}) {
  const sheetRows = statRows(t, capSheetStats(sheetBefore), capSheetStats(sheetAfter), SHEET_STAT_KEYS);
  const hitDamageRows = hitRows(t, hitBefore, hitAfter, combatBefore, combatAfter);
  const columnLabels = {
    label: t.colStat,
    now: t.teamPlanColBefore,
    target: t.teamPlanColAfter,
    change: t.teamPlanColDelta,
  };
  return (
    <div className="flex flex-col gap-3">
      <section className="min-w-0">
        <h4 className={subheadingClass}>{t.teamPlanHeroBreakdownStatsSheetTitle}</h4>
        <DeltaTable
          caption={t.teamPlanHeroBreakdownStatsSheetTitle}
          columnLabels={columnLabels}
          rows={sheetRows}
          decimals={2}
          striped
        />
      </section>
      <section className="min-w-0">
        <h4 className={subheadingClass}>{t.teamPlanHeroBreakdownHitTitle}</h4>
        <DeltaTable
          caption={t.teamPlanHeroBreakdownHitTitle}
          columnLabels={columnLabels}
          rows={hitDamageRows}
          decimals={0}
          striped
        />
      </section>
    </div>
  );
}
