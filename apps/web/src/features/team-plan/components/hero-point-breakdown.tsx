'use client';

import { SHEET_PANEL_KEYS } from '@bombfarm/domain/planner-constants';
import type { PointAlloc } from '@bombfarm/domain/gear';
import type { Strings } from '@/shared/i18n';
import { StatDeltaGrid, type StatDeltaRow } from './stat-delta-grid';

export function HeroPointBreakdown({
  t,
  pointsBefore,
  pointsAfter,
}: {
  t: Strings;
  pointsBefore: PointAlloc;
  pointsAfter: PointAlloc;
}) {
  const rows: StatDeltaRow[] = SHEET_PANEL_KEYS.filter(
    (key) => pointsBefore[key] !== 0 || pointsAfter[key] !== 0,
  ).map((key) => ({
    key,
    label: t.statShort[key],
    before: pointsBefore[key],
    after: pointsAfter[key],
  }));
  if (rows.length === 0) return null;
  return <StatDeltaGrid t={t} rows={rows} decimals={0} />;
}
