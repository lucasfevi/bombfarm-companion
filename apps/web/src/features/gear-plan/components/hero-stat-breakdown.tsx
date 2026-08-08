'use client';

import type { GearPlanHeroStats } from '@bombfarm/domain/gear-plan/types';
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
] as const satisfies readonly (keyof GearPlanHeroStats)[];

export function HeroStatBreakdown({
  t,
  statsBefore,
  statsAfter,
}: {
  t: Strings;
  statsBefore: GearPlanHeroStats;
  statsAfter: GearPlanHeroStats;
}) {
  const rows: StatDeltaRow[] = BREAKDOWN_STAT_KEYS.map((key) => ({
    key,
    label: t.statShort[key],
    before: statsBefore[key],
    after: statsAfter[key],
  }));
  return <StatDeltaGrid t={t} rows={rows} decimals={2} />;
}
