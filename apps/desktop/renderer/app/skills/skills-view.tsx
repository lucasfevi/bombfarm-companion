'use client';

/**
 * The Skill Tree screen — the account's tree as the game lays it out, and what one more level of
 * each buyable node is worth. The drawing is `@bombfarm/account/skill-tree`'s; this file is its
 * connector, and `skill-tree-labels.ts` beside it is its vocabulary.
 *
 * A node is priced under the Farm board's own inputs — the same roster, pool overrides, return
 * bonus and auras, on the phase the Farm tab is set to — so the figures here agree with the board.
 * Pricing costs about a tenth of a second for a full roster, and the account view is re-read every
 * few seconds, so it is keyed by value and recomputed only when something it reads has changed.
 * Where the board itself could not be priced the tree still draws, without figures.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { SkillTreeScreen } from '@bombfarm/account/skill-tree';
import {
  parseSkillTreeState,
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
import { priceSkillsView, skillsPricingKey, skillsTotalsOf } from '../../lib/skills/skills-pricing';
import { loadSkillsView, saveSkillsView } from '../../lib/skills/skills-view-storage';
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

function useStoredObjective(): [SkillPricingObjective, (next: SkillPricingObjective) => void] {
  const [objective, setObjective] = useState<SkillPricingObjective>('goldPerHour');
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    setObjective(loadSkillsView().objective);
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    saveSkillsView({ objective });
  }, [storageReady, objective]);

  return [objective, setObjective];
}

export function SkillsView() {
  const t = useCopy();
  const { lang } = useLocale();
  const accountViewState = useAccountView();
  const farmPhase = useFarmSelectedPhase();
  const controls = useStoredFarmControls();
  const [objective, setObjective] = useStoredObjective();
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
  const phaseSource: SkillsPhaseSource = phaseReading.kind === 'at' && phaseReading.selection.kind === 'override' ? 'account' : 'farm';
  const labels = useMemo(() => skillTreeLabels(t, lang, phaseSource), [t, lang, phaseSource]);
  const inputs = view === null || controls === null ? null : buildFarmInputs(view, controls);
  const pricingKey =
    inputs === null || state === null || phase === null ? null : skillsPricingKey(inputs, state, phase);
  const pricing = useKeyedMemo<SkillTreePricing | null>(pricingKey, () =>
    inputs === null || state === null || totals === null || phase === null
      ? null
      : priceSkillsView(inputs, state, totals, phase),
  );

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
      className={cn(colClass, 'relative', 'min-h-0', 'flex-1')}
    >
      <SkillTreeScreen
        catalog={SKILL_TREE}
        layout={SKILL_TREE_LAYOUT}
        state={state}
        totals={totals}
        pricing={pricing}
        objective={objective}
        onObjectiveChange={setObjective}
        nodeArtSrc={skillNodeArtSrc}
        labels={labels}
      />
    </div>
  );
}
