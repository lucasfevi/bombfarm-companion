'use client';

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { colClass, phasesBoardClass, phasesBoardRosterClass } from '@bombfarm/ui/panel-field.recipe';
import { PhasePicker } from './phase-picker';
import { PhaseMapFactsPanel } from './phase-map-facts-panel';
import { PhaseEconomyPanel } from './phase-economy-panel';
import { PhaseJaulaPanel } from './phase-jaula-panel';
import { PhaseDropsPanel } from './phase-drops-panel';
import { PhasePropMixTable } from './phase-prop-mix-table';
import { PhasesHeroPanel } from './phases-hero-panel';
import { PhasesSquadPanel } from './phases-squad-panel';
import { PhasesEmptyRoster } from './phases-empty-roster';
import { computePhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
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
  selectFarmBoardRows,
  selectPhasesViewPhase,
  commitActiveHero,
} from '@/shared/stores';

export function PhasesExplorer({ t, lang }: { t: Strings; lang: Lang }) {
  const phase = usePlannerStore(selectPhasesViewPhase);
  const setPhasesViewPhase = usePlannerStore((state) => state.setPhasesViewPhase);
  const heroes = usePlannerStore(selectHeroes);
  const activeHeroId = usePlannerStore(selectActiveHeroId);
  const account = usePlannerStore(useShallow(selectAccountShared));
  // The ranking board's own rows — no `useShallow`, same carve-out the board itself relies on.
  const farmRows = usePlannerStore(selectFarmBoardRows);
  // FIELD concurrency — who can be on the field at once, not the House recovery number
  // (`account.slots`). `account.slots` here is only the pre-`skills.field_slots` fallback
  // (same convention as `SquadFarmFacts` in `farm-rate.ts`).
  const squadSlots = account.fieldSlots ?? account.slots ?? DEFAULT_CASA_SLOTS;

  const teamCoinPct = account.tree.teamCoinPct ?? 0;
  const xpMult = account.tree.xpMult ?? 1;

  // Map/mitigation facts don't depend on teamCoinPct/xpMult/luckFraction, so this pass gives
  // `topSquadRows` a `phase`/`mitigationPct` to rank against before the squad's own average luck
  // (derived FROM those rows, below) is known — without running the advisor pipeline twice per
  // hero. `computePhaseIntelGlobal` itself is cheap wiki-table math, not a pipeline call, so
  // running it twice here is fine; `rankRosterByDps` (the actual per-hero pipeline cost) still
  // runs exactly once.
  const intelBase = useMemo(
    () => computePhaseIntelGlobal(phase, { teamCoinPct, xpMult }),
    [phase, teamCoinPct, xpMult],
  );

  const topSquadRows = useMemo(
    () =>
      intelBase
        ? rankRosterByDps(
            {
              heroes,
              account,
              phase: intelBase.phase,
              mitigationPct: intelBase.mitigationPct,
            },
            squadSlots,
          )
        : [],
    [heroes, account, intelBase, squadSlots],
  );

  // Mean of the top-squad rows' pipeline-adjusted Luck (percentage points) -> fraction. Empty
  // roster -> 0 (no drop-chance boost), matching `dropAppliesOnPhase`'s "no boost" default.
  // `row.luck` is `pipeline.adjusted.luck`, which already carries the tree's flat luck add on
  // EVERY hero (same convention `farm-rate.ts` documents for `heroLuckPct`) — so this mean equals
  // `mean(heroLuckPct) + treeLuckFlatPct` exactly, `treeLuckFlatPct` being a per-hero constant.
  // That is what makes `squadLuckPct` below a clean peel rather than an approximation.
  const luckFraction = useMemo(() => {
    if (topSquadRows.length === 0) return 0;
    const sum = topSquadRows.reduce((total, row) => total + row.luck, 0);
    return sum / topSquadRows.length / 100;
  }, [topSquadRows]);

  // The Drops panel's boost breakdown (`phase-fact-items.tsx`'s `dropItems`) wants the two
  // components separately: the skill tree's flat luck add, and the squad's own average with that
  // share peeled back out. `treeLuckFlatPct` is the account fact directly; `squadLuckPct` is
  // derived rather than re-averaged so it is guaranteed to sum to `luckFraction * 100` by
  // construction, not by two independent computations happening to agree. Zeroed with an empty
  // roster so it never prints a negative squad share when there is no squad to have one.
  const treeLuckFlatPct = account.tree.luckFlatPct ?? 0;
  const squadLuckPct = useMemo(() => {
    if (topSquadRows.length === 0) return 0;
    return Math.max(0, luckFraction * 100 - treeLuckFlatPct);
  }, [topSquadRows.length, luckFraction, treeLuckFlatPct]);

  const intel = useMemo(
    () =>
      computePhaseIntelGlobal(phase, {
        teamCoinPct,
        xpMult,
        luckFraction,
        treeLuckFlatPct,
        squadLuckPct,
      }),
    [phase, teamCoinPct, xpMult, luckFraction, treeLuckFlatPct, squadLuckPct],
  );

  const heroesById = useMemo(() => new Map(heroes.map((hero) => [hero.id, hero])), [heroes]);

  const squadDps = sumTopDps(topSquadRows);

  // The SAME number the ranking board prints for this phase, read off its row rather than
  // re-derived. The panel used to divide total map HP by summed solo DPS, which credits the
  // overkill a killing blow wastes: on the phase-51 anchor roster that model reads 52.6s against
  // a measured 85.9s, where `FarmRateRow.clearSecs` — which charges `ceil(propHp / avgHit)` per
  // prop and adds the gate boss — reads 83.8s.
  const clearSecs = useMemo(
    () => farmRows.rows.find((row) => row.phase === phase)?.clearSecs ?? null,
    [farmRows, phase],
  );

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
        <PhaseDropsPanel intel={intel} />
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
