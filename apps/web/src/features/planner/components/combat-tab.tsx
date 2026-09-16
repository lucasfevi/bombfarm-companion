'use client';

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { CombatPhasePanel } from '@bombfarm/farm/components';
import type { SheetKey } from '@bombfarm/domain/planner-constants';
import { AbilitiesAurasPanel, CombatBreakdownPanel, HeroRunesPanel } from '@bombfarm/hero/components';
import { colClass } from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import {
  usePlannerStore,
  selectCombatPhase,
  selectCombatPhaseSelection,
  selectDraftHeroRecord,
  selectTeamAuraDpsDeltas,
  selectTeamAuraSwitches,
} from '@/shared/stores';
import { usePipelineFacts } from '../hooks/use-pipeline-facts';

/**
 * The workspace's Combat tab: the phase the figures are for, the timed runes the hero carries
 * at it, the per-statistic breakdown those figures came from, and last the abilities and team
 * auras they were priced with — the same panels the desktop app's Heroes screen draws on its
 * Combat stage, from the same implementations. The hero itself is the one the strip above holds.
 *
 * The phase pick and the aura switches are the controls here that change what another tab
 * prints: the hero strip, Gear and Points all read the same pipeline, so they follow both.
 * "Back to your current phase" drops both at once.
 */
export function CombatTab() {
  const { t, lang } = useAppLang();
  const hero = usePlannerStore(selectDraftHeroRecord);
  const phase = usePlannerStore(selectCombatPhase);
  const phaseSelection = usePlannerStore(useShallow(selectCombatPhaseSelection));
  const setPlannerPhaseOverride = usePlannerStore((state) => state.setPlannerPhaseOverride);
  const clearPlannerWhatIfs = usePlannerStore((state) => state.clearPlannerWhatIfs);
  const auraSwitches = usePlannerStore(selectTeamAuraSwitches);
  const auraDeltas = usePlannerStore(selectTeamAuraDpsDeltas);
  const setTeamAuraSwitch = usePlannerStore((state) => state.setTeamAuraSwitch);
  const facts = usePipelineFacts();
  const statLabel = useCallback((key: SheetKey) => t.statFull[key], [t]);

  return (
    <div className={colClass}>
      <CombatPhasePanel
        phase={phase}
        overridden={phaseSelection.kind === 'override'}
        onOverridePhase={setPlannerPhaseOverride}
        onClearOverride={clearPlannerWhatIfs}
        lang={lang}
      />
      <HeroRunesPanel hero={hero} lang={lang} statLabel={statLabel} />
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
