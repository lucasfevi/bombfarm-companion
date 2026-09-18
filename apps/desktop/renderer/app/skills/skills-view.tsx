'use client';

/**
 * The Skill Tree screen — the account's tree as the game lays it out, and what one more level of
 * each buyable node is worth. The drawing is `@bombfarm/account/skill-tree`'s; this file is its
 * connector, and `skill-tree-labels.ts` beside it is its vocabulary.
 *
 * A node is priced under the Farm board's own inputs — the same roster, pool overrides, return
 * bonus and auras, on the phase the Farm tab is set to — so the figures here agree with the board.
 * Combat ranking uses a timed window: Gate clear on an auto-picked squad at a chosen gate, PVP
 * on the standing squad over 60s. Pricing is keyed by value and recomputed only when those
 * inputs move. Where the board itself could not be priced the tree still draws, without figures.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { SkillTreeScreen } from '@bombfarm/account/skill-tree';
import {
  parseSkillTreeState,
  resolveGatePhase,
  SKILL_TREE,
  SKILL_TREE_LAYOUT,
  type SkillPricingObjective,
  type SkillTreePricing,
} from '@bombfarm/domain/skill-tree';
import { skillNodeArtSrc } from '@bombfarm/domain/wiki-assets';
import { Banner, EmptyState, cn, colClass } from '@bombfarm/ui';
import { useCopy, useLocale } from '../../lib/copy';
import { useAccountView } from '../../lib/account/use-account-view';
import { isSectionUsable, sectionFidelityOf } from '../../lib/account/account-facts';
import type { AccountView } from '@bombfarm/contracts';
import { buildAccountRoster } from '../../lib/account/account-roster';
import { buildFarmInputs } from '../../lib/farm/farm-inputs';
import { pvpCombatInput } from '../../lib/skills/pvp-combat-input';
import { gateCombatInput } from '@bombfarm/farm/core';
import { priceSkillsView, skillsPricingKey, skillsTotalsOf } from '../../lib/skills/skills-pricing';
import { DEFAULT_SKILLS_VIEW, loadSkillsView, saveSkillsView, type SkillsView } from '../../lib/skills/skills-view-storage';
import { refreshPvpStanding, usePvpHistory } from '../../lib/pvp/use-pvp-history';
import { readHeroPhase } from '../heroes/hero-phase';
import { useFarmSelectedPhase } from '../heroes/use-farm-selected-phase';
import { skillTreeLabels, type SkillsPhaseSource } from './skill-tree-labels';
import { useStoredFarmControls } from './use-stored-farm-controls';

/** The phase the account is farming right now, for a Farm tab that has picked none. */
function accountPhaseOf(view: AccountView | null): number | null {
  if (view === null) return null;
  const roster = buildAccountRoster(view);
  return roster?.account.phase ?? null;
}

/** A memo over a value key rather than a reference: the compute runs once per distinct key. */
function useKeyedMemo<T>(key: string | null, compute: () => T): T {
  const cache = useRef<{ key: string | null; value: T } | null>(null);
  if (cache.current === null || cache.current.key !== key) {
    cache.current = { key, value: compute() };
  }
  return cache.current.value;
}

function useStoredSkillsView(fromPhase: number | null): {
  objective: SkillPricingObjective;
  setObjective: (next: SkillPricingObjective) => void;
  gatePhase: number;
  setGatePhase: (next: number) => void;
} {
  const [view, setView] = useState<SkillsView>(DEFAULT_SKILLS_VIEW);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    setView(loadSkillsView());
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady || view.gatePhase !== null || fromPhase === null) return;
    setView((current) => ({ ...current, gatePhase: resolveGatePhase(null, fromPhase) }));
  }, [storageReady, view.gatePhase, fromPhase]);

  useEffect(() => {
    if (!storageReady) return;
    saveSkillsView(view);
  }, [storageReady, view]);

  const gatePhase = resolveGatePhase(view.gatePhase, fromPhase ?? 1);
  return {
    objective: view.objective,
    setObjective: (objective) => {
      setView((current) => ({ ...current, objective }));
    },
    gatePhase,
    setGatePhase: (next) => {
      setView((current) => ({ ...current, gatePhase: next }));
    },
  };
}

export function SkillsView() {
  const t = useCopy();
  const { lang } = useLocale();
  const accountViewState = useAccountView();
  const farmPhase = useFarmSelectedPhase();
  const controls = useStoredFarmControls();
  const pvpHistory = usePvpHistory();
  const view = accountViewState.status === 'loaded' ? accountViewState.view : null;
  const treeUsable = view !== null && isSectionUsable(sectionFidelityOf(view.payload, 'skills'));
  const state = useMemo(
    () => (view === null || !treeUsable ? null : parseSkillTreeState(view.payload.skills)),
    [view, treeUsable],
  );
  const totals = useMemo(() => (state === null ? null : skillsTotalsOf(state)), [state]);

  const accountPhase = useMemo(() => accountPhaseOf(view), [view]);
  const phaseReading = readHeroPhase(farmPhase, farmPhase.phase === null ? accountPhase : null);
  const phase = phaseReading.kind === 'at' ? phaseReading.selection.phase : null;
  const { objective, setObjective, gatePhase, setGatePhase } = useStoredSkillsView(phase);
  const phaseSource: SkillsPhaseSource = phaseReading.kind === 'at' && phaseReading.selection.kind === 'override' ? 'account' : 'farm';
  const labels = useMemo(() => skillTreeLabels(t, lang, phaseSource), [t, lang, phaseSource]);
  const inputs = view === null || controls === null ? null : buildFarmInputs(view, controls);

  useEffect(() => {
    if (objective === 'pvp') refreshPvpStanding();
  }, [objective]);

  const rosterIds = useMemo(() => new Set(inputs?.heroes.map((hero) => hero.id) ?? []), [inputs]);
  const pvp = pvpCombatInput(pvpHistory.status === 'ready' ? pvpHistory.history : null, rosterIds);
  const pricingKey =
    inputs === null || state === null || phase === null
      ? null
      : skillsPricingKey(inputs, state, phase, {
          objective,
          gatePhase,
          pvpHeroIds: pvp.heroIds,
          pvpPhase: pvp.phase,
        });
  const pricing = useKeyedMemo<SkillTreePricing | null>(pricingKey, () => {
    if (inputs === null || state === null || totals === null || phase === null) return null;
    const combat = objective === 'pvp' ? pvp : gateCombatInput(inputs, gatePhase);
    return priceSkillsView(inputs, state, totals, phase, combat);
  });

  if (accountViewState.status === 'loading') {
    return (
      <div data-testid="skills-view">
        <EmptyState title={t.accountLoadingTitle} />
      </div>
    );
  }

  if (accountViewState.status === 'bridge-unavailable') {
    return (
      <div data-testid="skills-view">
        <EmptyState title={t.emptyBridgeUnavailableTitle} />
      </div>
    );
  }

  if (accountViewState.status === 'error') {
    return (
      <div data-testid="skills-view">
        <Banner
          tone="warn"
          title={t.errorAccountReadFailed}
          data-account-error-detail={accountViewState.message}
        >
          {t.errorAccountReadFailedDescription}
        </Banner>
      </div>
    );
  }

  if (state === null || totals === null) {
    return (
      <div data-testid="skills-view">
        <EmptyState title={t.skillsUnreadableTitle} description={t.accountUnavailableDescription} />
      </div>
    );
  }

  return (
    <div
      data-testid="skills-view"
      data-pricing={pricing === null ? 'none' : 'priced'}
      className={cn(colClass, 'absolute', 'inset-0', 'min-h-0', 'overflow-y-auto', 'min-[960px]:overflow-hidden')}
    >
      <SkillTreeScreen
        catalog={SKILL_TREE}
        layout={SKILL_TREE_LAYOUT}
        state={state}
        totals={totals}
        pricing={pricing}
        objective={objective}
        onObjectiveChange={setObjective}
        gatePhase={gatePhase}
        onGatePhaseChange={setGatePhase}
        pvpEmpty={objective === 'pvp' && pvp.empty}
        nodeArtSrc={skillNodeArtSrc}
        labels={labels}
      />
    </div>
  );
}
