'use client';

import { gameSheetView } from '@bombfarm/domain/model';
import type { TeamPlanHeroStats } from '@bombfarm/domain/team-plan/types';
import type { Strings } from '@/shared/i18n';
import { StatDeltaGrid, type StatDeltaRow } from './stat-delta-grid';

/** `HeroSheet` fields shown in the per-hero breakdown, in display order. */
const BREAKDOWN_STAT_KEYS = [
  'attack',
  'energy',
  'speed',
  'critChance',
  'critDmg',
  'penetration',
  'cdr',
] as const satisfies readonly (keyof TeamPlanHeroStats)[];

const subheadingClass = 'm-0 mb-1 text-[9px] font-bold leading-none tracking-[0.06em] text-muted uppercase';

function statRows(strings: Strings, before: TeamPlanHeroStats, after: TeamPlanHeroStats): StatDeltaRow[] {
  return BREAKDOWN_STAT_KEYS.map((key) => ({
    key,
    label: strings.statShort[key],
    before: before[key],
    after: after[key],
  }));
}

/**
 * Sheet stats pass through `gameSheetView` (`sheet-view.ts`) so they match what the game's own
 * hero panel shows (100% crit chance / 80% CDR clamp) — the combat view stays uncapped
 * (combat crit chance legitimately exceeds the sheet cap via Presságio Mortal and similar).
 * `TeamPlanHeroStats` carries no `luck` field, so a placeholder `0` is spread in only to
 * satisfy `SheetStats`'s shape and dropped again after capping — it never reaches either grid.
 */
function capSheetStats(stats: TeamPlanHeroStats): TeamPlanHeroStats {
  const viewed = gameSheetView({ ...stats, luck: 0 });
  return {
    attack: viewed.attack,
    energy: viewed.energy,
    speed: viewed.speed,
    critChance: viewed.critChance,
    critDmg: viewed.critDmg,
    penetration: viewed.penetration,
    cdr: viewed.cdr,
  };
}

export function HeroStatBreakdown({
  t,
  sheetBefore,
  sheetAfter,
  combatBefore,
  combatAfter,
}: {
  t: Strings;
  sheetBefore: TeamPlanHeroStats;
  sheetAfter: TeamPlanHeroStats;
  combatBefore: TeamPlanHeroStats;
  combatAfter: TeamPlanHeroStats;
}) {
  const sheetRows = statRows(t, capSheetStats(sheetBefore), capSheetStats(sheetAfter));
  const combatRows = statRows(t, combatBefore, combatAfter);
  return (
    <div className="flex flex-col gap-3">
      <section className="min-w-0">
        <h4 className={subheadingClass}>{t.teamPlanHeroBreakdownStatsSheetTitle}</h4>
        <StatDeltaGrid t={t} rows={sheetRows} decimals={2} />
      </section>
      <section className="min-w-0">
        <h4 className={subheadingClass}>{t.teamPlanHeroBreakdownStatsCombatTitle}</h4>
        <StatDeltaGrid t={t} rows={combatRows} decimals={2} />
      </section>
    </div>
  );
}
