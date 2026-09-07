'use client';

import { HeroAbilitiesTab } from './hero-abilities-tab';
import { AdviceColumn } from './advice-column';
import { HeroStrip } from './hero-strip';
import { GearTab } from '@bombfarm/hero/components';
import { Tabs, Tooltip } from '@bombfarm/ui';
import type { TabStatus } from '@bombfarm/domain/planner-tab-status';
import { usePlannerTab } from '../hooks/use-planner-tab';
import { useHeroBuildActions } from '../hooks/use-hero-build-actions';
import { SlotEditor } from '@/features/gear';
import { plannerStageClass } from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import {
  usePlannerStore,
  selectAdvisorPipeline,
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
  const { t, lang } = useAppLang();
  const setupReady = usePlannerStore(selectSetupReady);
  const heroTabStatus = usePlannerStore(selectHeroTabStatus);
  const gearTabStatus = usePlannerStore(selectGearTabStatus);
  const pointsTabStatus = usePlannerStore(selectPointsTabStatus);
  const noHeroYet = usePlannerStore(selectShouldShowEmptyState);
  const { tab, setTab } = usePlannerTab(setupReady);

  const pipeline = usePlannerStore(selectAdvisorPipeline);
  const loadout = usePlannerStore((state) => state.loadout);
  const altLoadout = usePlannerStore((state) => state.altLoadout);
  const { setSlot, setAltSlot, clearCompare, copyGear, applyAltGear } = useHeroBuildActions();

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
              <GearTab
                t={t}
                lang={lang}
                loadout={loadout}
                altLoadout={altLoadout}
                pipeline={pipeline}
                editing={{
                  onPatchSlot: setSlot,
                  onPatchAltSlot: setAltSlot,
                  onApplyAltGear: applyAltGear,
                  onCopyGear: copyGear,
                  onClearCompare: clearCompare,
                }}
                renderSlot={({ slot, equipped, changed, onPatch }) => (
                  <SlotEditor
                    slot={slot}
                    equipped={equipped}
                    changed={changed}
                    t={t}
                    lang={lang}
                    onPatch={onPatch}
                  />
                )}
              />
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
