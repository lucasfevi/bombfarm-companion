'use client';

/**
 * The Planning screen (design.md §1, §7.2). Composes `@bombfarm/ui` primitives against the pure
 * `renderer/lib/planning/*` modules — nothing is recomputed in a component. `selectedHeroId` is
 * leaf-owned here (`docs/react-performance.md` rule 1); the account is read once via
 * `useAccountView()` and the parsed model is a `useMemo` over the `AccountView` reference (TD-4:
 * the desktop renderer does not enable the React Compiler, so this hand memoisation is correct,
 * not a violation of the rule that forbids it in `apps/web`).
 */
import { useMemo, useState } from 'react';
import { Banner, EmptyState, Panel } from '@bombfarm/ui';
import { STORE_REASON_COPY_KEY, useCopy } from '../../lib/copy';
import { buildPlanningModel } from '../../lib/planning/account-model';
import { useAccountView } from '../../lib/planning/use-account-view';
import { FidelityNotice } from './fidelity-notice';
import { HeroDetail } from './hero-detail';
import { NextPointPanel } from './next-point-panel';
import { RosterList } from './roster-list';

export function PlanningView() {
  const t = useCopy();
  const accountViewState = useAccountView();
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);

  const view = accountViewState.status === 'loaded' ? accountViewState.view : null;
  // Keyed by the `AccountView` reference (TD-4) — the IPC boundary structurally clones on every
  // real invoke, so identity only ever changes when there is genuinely a new view to parse.
  const model = useMemo(() => (view ? buildPlanningModel(view) : null), [view]);

  if (accountViewState.status === 'loading') {
    return (
      <div data-testid="planning-view">
        <EmptyState title={t.planningLoadingTitle} />
      </div>
    );
  }

  if (accountViewState.status === 'bridge-unavailable') {
    return (
      <div data-testid="planning-view">
        <EmptyState title={t.emptyBridgeUnavailableTitle} />
      </div>
    );
  }

  if (accountViewState.status === 'error') {
    // MP3 F4 (design §2.8): the raw Error message crossing from main is untranslatable English —
    // it is kept as DIAGNOSTIC data only (a data- attribute the copy guard allowlists, since it
    // is a variable, never a string literal) and never rendered as player-facing body copy. The
    // spec's own edge case: a main-process error crosses the boundary as a key or code, not as
    // pre-rendered English.
    return (
      <div data-testid="planning-view">
        <Banner tone="warn" title={t.errorAccountReadFailed} data-account-error-detail={accountViewState.message}>
          {t.errorAccountReadFailedDescription}
        </Banner>
      </div>
    );
  }

  if (!model) {
    // Unreachable (status === 'loaded' implies `view`, which implies `model`) — typed narrowly
    // rather than asserted, so a future refactor that breaks the implication fails loudly here.
    return <div data-testid="planning-view" />;
  }

  if (model.availability === 'nothing-persisted') {
    return (
      <div data-testid="planning-view">
        <EmptyState title={t.planningNothingPersistedTitle} description={t.planningNothingPersistedDescription} />
      </div>
    );
  }

  if (model.availability === 'rejected' && model.rejected) {
    const title =
      model.rejected.reason === 'missingBirthStats'
        ? t.planningRejectedTitleMissingBirthStats
        : t.planningRejectedTitleNotASaveFile;
    const description =
      model.rejected.reason === 'missingBirthStats'
        ? `${t.planningRejectedDescriptionMissingBirthStats} ${model.rejected.heroNames.join(', ')}`
        : undefined;
    return (
      <div data-testid="planning-view">
        <EmptyState title={title} description={description} />
      </div>
    );
  }

  if (model.availability === 'no-roster') {
    return (
      <div data-testid="planning-view">
        <EmptyState title={t.planningNoRosterTitle} description={t.planningNoRosterDescription} />
      </div>
    );
  }

  // 'store-unavailable' | 'partial' | 'complete' — the roster and per-hero advice render on the
  // same per-section rule regardless; 'store-unavailable' additionally shows the persistence
  // notice (spec.md edge case: "still render live sections if any resolved").
  const effectiveSelectedHeroId = selectedHeroId ?? model.heroes[0]?.hero.id ?? null;

  return (
    <div data-testid="planning-view" className="flex flex-col gap-4">
      {model.availability === 'store-unavailable' && model.store.reason ? (
        <Banner tone="warn" title={t.planningStoreUnavailableNotice}>
          {t[STORE_REASON_COPY_KEY[model.store.reason]]}
        </Banner>
      ) : null}
      <FidelityNotice model={model} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel>
          <RosterList
            heroes={model.heroes}
            selectedHeroId={effectiveSelectedHeroId}
            onSelect={setSelectedHeroId}
          />
        </Panel>
        <div className="flex flex-col gap-4">
          <HeroDetail model={model} heroId={effectiveSelectedHeroId} />
          <NextPointPanel model={model} heroId={effectiveSelectedHeroId} />
        </div>
      </div>
    </div>
  );
}
