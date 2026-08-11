'use client';

import { gameSheetView } from '@bombfarm/domain/model';
import { SHEET_PANEL_KEYS } from '@bombfarm/domain/planner-constants';
import type { TeamPlanHeroStats } from '@bombfarm/domain/team-plan/types';
import type { Strings } from '@/shared/i18n';
import { StatDeltaGrid, type StatDeltaRow } from './stat-delta-grid';

/** `HeroSheet` fields shown in the Combat grid, in display order (no Luck — see below). */
const BREAKDOWN_STAT_KEYS = SHEET_PANEL_KEYS.filter(
  (key) => key !== 'luck',
) as readonly (keyof TeamPlanHeroStats)[];

/**
 * Sheet grid only: Luck never reaches `HeroSheet`/combat (BSP-42, AD-BSP-20, AD-BSP-21 —
 * excluded from DPS scoring, `REOPT_KEYS`, and this display never feeds back into either), so
 * there is no meaningful Combat-stats row for it — a combat row would either duplicate the
 * sheet value or invent a combat transformation that doesn't exist. Display-only, ordered by
 * `SHEET_PANEL_KEYS` so it lands right after Speed, matching the Planner sheet table's own
 * Luck row placement (`DEC-06`, `AC-19`).
 */
const SHEET_ONLY_STAT_KEYS = SHEET_PANEL_KEYS as readonly (keyof TeamPlanHeroStats)[];

const subheadingClass = 'm-0 mb-1 text-[9px] font-bold leading-none tracking-[0.06em] text-muted uppercase';

function statRows(
  strings: Strings,
  before: TeamPlanHeroStats,
  after: TeamPlanHeroStats,
  keys: readonly (keyof TeamPlanHeroStats)[],
): StatDeltaRow[] {
  return keys.map((key) => ({
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
 * `TeamPlanHeroStats` now carries a real `luck` (structurally identical to `SheetStats`), so it
 * passes through `gameSheetView` directly — `gameSheetView` never lowers `luck` (no display cap
 * for it, `sheet-view.ts`), it only rides along unchanged.
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
  strings: Strings,
  hitBefore: number,
  hitAfter: number,
  combatBefore: TeamPlanHeroStats,
  combatAfter: TeamPlanHeroStats,
): StatDeltaRow[] {
  return [
    {
      key: 'hitNormal',
      label: strings.teamPlanHeroHitNormal,
      before: hitBefore,
      after: hitAfter,
    },
    {
      key: 'hitCritical',
      label: strings.teamPlanHeroHitCritical,
      before: hitBefore * (1 + combatBefore.critDmg / 100),
      after: hitAfter * (1 + combatAfter.critDmg / 100),
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
  t: Strings;
  sheetBefore: TeamPlanHeroStats;
  sheetAfter: TeamPlanHeroStats;
  combatBefore: TeamPlanHeroStats;
  combatAfter: TeamPlanHeroStats;
  hitBefore: number;
  hitAfter: number;
}) {
  const sheetRows = statRows(t, capSheetStats(sheetBefore), capSheetStats(sheetAfter), SHEET_ONLY_STAT_KEYS);
  const combatRows = statRows(t, combatBefore, combatAfter, BREAKDOWN_STAT_KEYS);
  const hitDamageRows = hitRows(t, hitBefore, hitAfter, combatBefore, combatAfter);
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
      <section className="min-w-0">
        <h4 className={subheadingClass}>{t.teamPlanHeroBreakdownHitTitle}</h4>
        <StatDeltaGrid t={t} rows={hitDamageRows} decimals={0} />
      </section>
    </div>
  );
}
