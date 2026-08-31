'use client';

import { HeroAbilitiesTab } from './hero-abilities-tab';
import { GearTab } from './gear-tab';
import { AdviceColumn } from './advice-column';
import { HeroStrip } from './hero-strip';
import { Tabs, Tooltip } from '@bombfarm/ui';
import type { TabStatus } from '@bombfarm/domain/planner-tab-status';
import { usePlannerTab } from '../hooks/use-planner-tab';
import { plannerStageClass } from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import {
  usePlannerStore,
  selectSetupReady,
  selectHeroTabStatus,
  selectGearTabStatus,
  selectPointsTabStatus,
  selectShouldShowEmptyState,
} from '@/shared/stores';

function statusProp(status: TabStatus) {
  return status.issues.length > 0
    ? { title: status.title, issues: status.issues }
    : null;
}

export function PlannerTabs() {
  const { t } = useAppLang();
  const setupReady = usePlannerStore(selectSetupReady);
  const heroTabStatus = usePlannerStore(selectHeroTabStatus);
  const gearTabStatus = usePlannerStore(selectGearTabStatus);
  const pointsTabStatus = usePlannerStore(selectPointsTabStatus);
  const noHeroYet = usePlannerStore(selectShouldShowEmptyState);
  const { tab, setTab } = usePlannerTab(setupReady);

  return (
    <div className={plannerStageClass}>
      {!noHeroYet ? <HeroStrip /> : null}
      <Tooltip.Provider delay={0} closeDelay={0}>
        <Tabs.Root value={tab} onValueChange={setTab}>
          <Tabs.List>
            <Tabs.Tab value="hero" badge={heroTabStatus.badge} status={statusProp(heroTabStatus)}>
              {t.tabHero}
            </Tabs.Tab>
            <Tabs.Tab value="gear" badge={gearTabStatus.badge} status={statusProp(gearTabStatus)}>
              {t.tabGear}
            </Tabs.Tab>
            <Tabs.Tab
              value="points"
              badge={pointsTabStatus.badge}
              status={statusProp(pointsTabStatus)}
            >
              {t.tabPoints}
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panels>
            <Tabs.Panel value="hero">
              <HeroAbilitiesTab />
            </Tabs.Panel>
            <Tabs.Panel value="gear">
              <GearTab />
            </Tabs.Panel>
            <Tabs.Panel value="points">
              <AdviceColumn />
            </Tabs.Panel>
          </Tabs.Panels>
        </Tabs.Root>
      </Tooltip.Provider>
    </div>
  );
}
