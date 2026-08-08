'use client';

import type { GearPlan } from '@bombfarm/domain/gear-plan/types';
import type { PointAlloc } from '@bombfarm/domain/gear';
import { Accordion, Panel, Tooltip } from '@bombfarm/ui';
import { panelHClass, panelTitleClass } from '@bombfarm/ui/panel-field.recipe';
import { accordionStackClass } from '@bombfarm/ui/accordion.recipe';
import type { Lang, Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { usePlannerStore, selectHeroes, selectInventoryItems } from '@/shared/stores';
import { shortHeroRecordId } from '@/features/gear-plan/model/build-gear-plan-input';
import { buildGearFlowRows, groupGearFlowRows } from '@/features/gear-plan/model/gear-flow-rows';
import { HeroIdentityChip } from './hero-identity-chip';
import { HeroDetailPanel } from './hero-detail-panel';
import { AbbreviatedNumber } from './abbreviated-number';

const metricLabelClass = 'text-[9px] font-bold leading-none tracking-[0.06em] text-muted uppercase';
const metricValueClass = 'font-mono text-[13px] font-semibold leading-none tabular-nums';

export function HeroDeltaTable({ t, lang, plan }: { t: Strings; lang: Lang; plan: GearPlan }) {
  const heroes = usePlannerStore(selectHeroes);
  const inventory = usePlannerStore(selectInventoryItems);
  const heroByScopeKey = new Map(heroes.map((hero) => [hero.sourceId ?? hero.id, hero]));

  const heroNameFallback = (heroId: string) =>
    plan.perHero.find((row) => row.heroId === heroId)?.heroName ?? heroId;

  const flowRows = buildGearFlowRows(plan, inventory);
  const flowGroups = groupGearFlowRows(
    flowRows,
    plan.perHero.map((row) => row.heroId),
  );
  const flowRowsByHero = new Map(
    flowGroups.filter((group) => group.heroId).map((group) => [group.heroId as string, group.rows]),
  );

  const firstHeroId = plan.perHero[0]?.heroId;
  // Remount when a new plan lands so the first row opens again after Optimize.
  const accordionKey = [
    plan.planDps,
    plan.currentDps,
    plan.run.rounds,
    plan.run.evaluations,
    plan.run.elapsedMs,
    plan.perHero.map((row) => row.heroId).join(','),
  ].join(':');

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.gearPlanHeroDeltaTitle}</h2>
      </div>
      <Tooltip.Provider delay={200} closeDelay={80}>
        <Accordion.Root
          key={accordionKey}
          multiple
          defaultValue={firstHeroId ? [firstHeroId] : []}
          className={accordionStackClass}
        >
          {plan.perHero.map((row) => {
            const hero = heroByScopeKey.get(row.heroId);
            const disambiguatedName = hero
              ? sub(t.gearPlanHeroRowLabel, {
                  name: row.heroName,
                  level: String(row.level),
                  id: shortHeroRecordId(hero),
                })
              : row.heroName;
            const pointReset = plan.pointResets.find((reset) => reset.heroId === row.heroId);
            const pointsReset =
              pointReset && hero
                ? // `pointReset.pts` is always a full absolute PointAlloc (buildPointResets uses
                  // `finalPtsByHeroId[heroId]`) — the domain type just widens it for storage ease.
                  { before: hero.pts, after: pointReset.pts as PointAlloc }
                : null;

            return (
              <Accordion.Item key={row.heroId} value={row.heroId}>
                <Accordion.Trigger
                  tone="row"
                  aria-label={sub(t.gearPlanHeroDeltaExpandAria, { name: disambiguatedName })}
                >
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                    <HeroIdentityChip hero={hero} fallbackName={row.heroName} lang={lang} />
                    <div className="ml-auto flex items-center gap-3">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={metricLabelClass}>{t.gearPlanColBefore}</span>
                        <AbbreviatedNumber value={row.before} className={metricValueClass} disableFocus />
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={metricLabelClass}>{t.gearPlanColAfter}</span>
                        <AbbreviatedNumber value={row.after} className={metricValueClass} disableFocus />
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={metricLabelClass}>{t.gearPlanColDelta}</span>
                        <AbbreviatedNumber
                          value={row.delta}
                          signed
                          disableFocus
                          className={`${metricValueClass} ${row.delta < 0 ? 'text-down' : row.delta > 0 ? 'text-up' : ''}`}
                        />
                      </div>
                    </div>
                  </div>
                </Accordion.Trigger>
                <Accordion.Panel>
                  <HeroDetailPanel
                    t={t}
                    lang={lang}
                    statsBefore={row.statsBefore}
                    statsAfter={row.statsAfter}
                    flowRows={flowRowsByHero.get(row.heroId) ?? []}
                    heroByScopeKey={heroByScopeKey}
                    heroNameFallback={heroNameFallback}
                    pointsReset={pointsReset}
                  />
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion.Root>
      </Tooltip.Provider>
    </Panel>
  );
}
