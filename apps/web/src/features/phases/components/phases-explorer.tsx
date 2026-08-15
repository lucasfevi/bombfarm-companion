'use client';

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { colClass, phasesBoardClass, phasesBoardRosterClass } from '@bombfarm/ui/panel-field.recipe';
import { PhasePicker } from './phase-picker';
import { PhaseMapFactsPanel } from './phase-map-facts-panel';
import { PhaseEconomyPanel } from './phase-economy-panel';
import { PhaseJaulaPanel } from './phase-jaula-panel';
import { PhasePropMixTable } from './phase-prop-mix-table';
import { PhasesHeroPanel } from './phases-hero-panel';
import { PhasesSquadPanel } from './phases-squad-panel';
import { PhasesEmptyRoster } from './phases-empty-roster';
import {
  computePhaseIntelGlobal,
  estimateClearSeconds,
} from '@bombfarm/domain/phase-intel';
import {
  computeHeroPhaseFitFromRecord,
  rankRosterByDps,
  sumTopDps,
} from '@bombfarm/domain/roster-dps';
import { DEFAULT_CASA_SLOTS } from '@bombfarm/domain/casa-slots';
import type { HeroRecord } from '@/shared/lib/storage';
import type { Lang, Strings } from '@/shared/i18n';
import {
  usePlannerStore,
  selectHeroes,
  selectActiveHeroId,
  selectAccountShared,
  selectPhasesViewPhase,
  commitActiveHero,
} from '@/shared/stores';

export function PhasesExplorer({ t, lang }: { t: Strings; lang: Lang }) {
  const phase = usePlannerStore(selectPhasesViewPhase);
  const setPhasesViewPhase = usePlannerStore((state) => state.setPhasesViewPhase);
  const heroes = usePlannerStore(selectHeroes);
  const activeHeroId = usePlannerStore(selectActiveHeroId);
  const account = usePlannerStore(useShallow(selectAccountShared));
  // FIELD concurrency — who can be on the field at once, not the House recovery number
  // (`account.slots`). `account.slots` here is only the pre-`skills.field_slots` fallback
  // (`AD-063`, same convention as `SquadFarmFacts` in `farm-rate.ts`).
  const squadSlots = account.fieldSlots ?? account.slots ?? DEFAULT_CASA_SLOTS;

  const teamCoinPct = account.tree.teamCoinPct ?? 0;

  const intel = useMemo(
    () => computePhaseIntelGlobal(phase, teamCoinPct),
    [phase, teamCoinPct],
  );

  const topSquadRows = useMemo(
    () =>
      intel
        ? rankRosterByDps(
            {
              heroes,
              account,
              phase: intel.phase,
              mitigationPct: intel.mitigationPct,
            },
            squadSlots,
          )
        : [],
    [heroes, account, intel, squadSlots],
  );

  const heroesById = useMemo(() => new Map(heroes.map((hero) => [hero.id, hero])), [heroes]);

  const squadDps = sumTopDps(topSquadRows);
  const clearSecs = intel ? estimateClearSeconds(intel.totalMapHp, squadDps) : null;

  const activeHero =
    heroes.find((hero) => hero.id === activeHeroId) ?? heroes[0];

  const selectHero = useCallback((hero: HeroRecord) => {
    commitActiveHero(hero);
  }, []);

  const heroFit =
    intel && activeHero
      ? computeHeroPhaseFitFromRecord(
          activeHero,
          account,
          intel.phase,
          intel.mitigationPct,
        )
      : null;

  const onPhase = useCallback(
    (next: number) => {
      setPhasesViewPhase(next);
    },
    [setPhasesViewPhase],
  );

  if (!intel) return null;

  return (
    <div className={colClass}>
      <PhasePicker phase={phase} onPhase={onPhase} t={t} lang={lang} />

      <div className={phasesBoardClass}>
        <PhaseMapFactsPanel intel={intel} />
        <PhaseEconomyPanel intel={intel} />
        <PhaseJaulaPanel intel={intel} />
        <PhasePropMixTable intel={intel} />

        <div className={phasesBoardRosterClass}>
          {heroes.length > 0 && activeHero ? (
            <>
              <PhasesHeroPanel
                heroes={heroes}
                hero={activeHero}
                heroFit={heroFit}
                onSelectHero={selectHero}
              />
              <PhasesSquadPanel
                topSquadRows={topSquadRows}
                slots={squadSlots}
                heroesById={heroesById}
                activeHeroId={activeHero.id}
                squadDps={squadDps}
                clearSecs={clearSecs}
                onSelectHero={selectHero}
              />
            </>
          ) : (
            <PhasesEmptyRoster />
          )}
        </div>
      </div>
    </div>
  );
}
