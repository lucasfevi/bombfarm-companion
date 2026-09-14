'use client';

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { CombatPhasePanel } from '@bombfarm/farm/components';
import {
  AbilitiesAurasPanel,
  CombatBreakdownPanel,
  HeroCopyProvider,
  PhasesHeroPanel,
  type HeroPickerSlotProps,
} from '@bombfarm/hero/components';
import { colClass } from '@bombfarm/ui/panel-field.recipe';
import { HeroPickerDialog } from '@/features/roster';
import { useAppLang } from '@/shared/context/app-lang';
import {
  usePlannerStore,
  selectAdvisorPipeline,
  selectCombatPhase,
  selectCombatPhaseSelection,
  selectDraftHeroRecord,
  selectHeroes,
  selectTeamAuraDpsDeltas,
  selectTeamAuraSwitches,
} from '@/shared/stores';
import { useHeroDraftActions } from '../hooks/use-hero-draft-actions';
import { usePipelineFacts } from '../hooks/use-pipeline-facts';

/**
 * The workspace's Combat tab: the phase the figures are for, one hero against that phase, the
 * per-statistic breakdown those figures came from, and last the abilities and team auras they
 * were priced with — the same panels the desktop app's Heroes screen draws on its Combat stage,
 * from the same implementations.
 *
 * The phase pick and the aura switches are the controls here that change what another tab
 * prints: the hero strip, Gear and Points all read the same pipeline, so they follow both.
 * "Back to your current phase" drops both at once.
 */
export function CombatTab() {
  const { t, lang } = useAppLang();
  const { applyHero } = useHeroDraftActions();
  const heroes = usePlannerStore(selectHeroes);
  const hero = usePlannerStore(selectDraftHeroRecord);
  const combat = usePlannerStore(selectAdvisorPipeline);
  const phase = usePlannerStore(selectCombatPhase);
  const phaseSelection = usePlannerStore(useShallow(selectCombatPhaseSelection));
  const setPlannerPhaseOverride = usePlannerStore((state) => state.setPlannerPhaseOverride);
  const clearPlannerWhatIfs = usePlannerStore((state) => state.clearPlannerWhatIfs);
  const auraSwitches = usePlannerStore(selectTeamAuraSwitches);
  const auraDeltas = usePlannerStore(selectTeamAuraDpsDeltas);
  const setTeamAuraSwitch = usePlannerStore((state) => state.setTeamAuraSwitch);
  const facts = usePipelineFacts();

  const slots = useMemo(
    () => ({
      renderPicker: (picker: HeroPickerSlotProps) => (
        <HeroPickerDialog {...picker} lang={lang} t={t} />
      ),
    }),
    [t, lang],
  );

  return (
    <div className={colClass}>
      <CombatPhasePanel
        phase={phase}
        overridden={phaseSelection.kind === 'override'}
        onOverridePhase={setPlannerPhaseOverride}
        onClearOverride={clearPlannerWhatIfs}
        lang={lang}
      />
      <HeroCopyProvider t={t} lang={lang}>
        <PhasesHeroPanel
          heroes={heroes}
          hero={hero}
          combat={combat}
          phaseSelection={phaseSelection}
          onSelectHero={applyHero}
          renderPicker={slots.renderPicker}
          breakdownShownElsewhere
        />
      </HeroCopyProvider>
      <CombatBreakdownPanel
        t={t}
        facts={facts}
        hero={hero}
        phase={phase}
        switches={auraSwitches}
        lang={lang}
      />
      <AbilitiesAurasPanel
        hero={hero}
        phase={phase}
        switches={auraSwitches}
        deltas={auraDeltas}
        onSwitch={setTeamAuraSwitch}
        lang={lang}
      />
    </div>
  );
}
