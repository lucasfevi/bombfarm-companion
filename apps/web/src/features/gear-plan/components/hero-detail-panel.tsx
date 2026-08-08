'use client';

import type { GearPlanHeroStats } from '@bombfarm/domain/gear-plan/types';
import type { PointAlloc } from '@bombfarm/domain/gear';
import { accordionLedgerBodyClass } from '@bombfarm/ui/accordion.recipe';
import type { Lang, Strings } from '@/shared/i18n';
import type { HeroRecord } from '@/shared/lib/storage';
import type { GearFlowRow } from '@/features/gear-plan/model/gear-flow-rows';
import { HeroStatBreakdown } from './hero-stat-breakdown';
import { HeroPointBreakdown } from './hero-point-breakdown';
import { HeroProposedGear } from './hero-proposed-gear';

const sectionTitleClass = 'm-0 mb-1.5 text-[10px] font-bold tracking-[0.08em] text-accent uppercase';

export function HeroDetailPanel({
  t,
  lang,
  statsBefore,
  statsAfter,
  flowRows,
  heroByScopeKey,
  heroNameFallback,
  pointsReset,
}: {
  t: Strings;
  lang: Lang;
  statsBefore: GearPlanHeroStats;
  statsAfter: GearPlanHeroStats;
  flowRows: GearFlowRow[];
  heroByScopeKey: Map<string, HeroRecord>;
  heroNameFallback: (heroId: string) => string;
  pointsReset: { before: PointAlloc; after: PointAlloc } | null;
}) {
  return (
    <div className={accordionLedgerBodyClass}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="min-w-0">
          <h3 className={sectionTitleClass}>{t.gearPlanHeroBreakdownGearTitle}</h3>
          <HeroProposedGear
            t={t}
            lang={lang}
            flowRows={flowRows}
            heroByScopeKey={heroByScopeKey}
            heroNameFallback={heroNameFallback}
          />
        </section>
        <div className="flex min-w-0 flex-col gap-4">
          <section className="min-w-0">
            <h3 className={sectionTitleClass}>{t.gearPlanHeroBreakdownPointsTitle}</h3>
            {pointsReset ? (
              <HeroPointBreakdown t={t} pointsBefore={pointsReset.before} pointsAfter={pointsReset.after} />
            ) : (
              <p className="m-0 text-[12px] text-muted">{t.gearPlanHeroBreakdownPointsEmpty}</p>
            )}
          </section>
          <section className="min-w-0">
            <h3 className={sectionTitleClass}>{t.gearPlanHeroBreakdownStatsTitle}</h3>
            <HeroStatBreakdown t={t} statsBefore={statsBefore} statsAfter={statsAfter} />
          </section>
        </div>
      </div>
    </div>
  );
}
