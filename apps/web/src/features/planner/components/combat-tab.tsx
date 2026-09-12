'use client';

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { CombatPhasePanel } from '@bombfarm/farm/components';
import {
  HeroCopyProvider,
  PhasesHeroPanel,
  TeamAuraSwitchesPanel,
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
  selectTeamAuraSwitches,
} from '@/shared/stores';
import { useHeroDraftActions } from '../hooks/use-hero-draft-actions';
import { usePipelineFacts } from '../hooks/use-pipeline-facts';
import { EffectiveStatsPanel } from './effective-stats-panel';

/**
 * The workspace's Combat tab: the phase the figures are for, the team auras they count, one hero
 * against that phase, and the per-statistic breakdown those figures came from — the same panels
 * the desktop app's Heroes screen draws on its Combat stage, from the same implementations.
 *
 * The phase pick and the aura switches are the controls here that change what another tab
 * prints: the hero strip, Gear and Points all read the same pipeline, so they follow both.
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
  const auraSwitches = usePlannerStore(selectTeamAuraSwitches);
  const setTeamAuraSwitch = usePlannerStore((state) => state.setTeamAuraSwitch);
  const facts = usePipelineFacts();

  const onClearOverride = useCallback(() => setPlannerPhaseOverride(null), [setPlannerPhaseOverride]);
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
        onClearOverride={onClearOverride}
        lang={lang}
      />
      <TeamAuraSwitchesPanel
        hero={hero}
        roster={heroes}
        switches={auraSwitches}
        onSwitch={setTeamAuraSwitch}
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
      <EffectiveStatsPanel facts={facts} />
    </div>
  );
}
