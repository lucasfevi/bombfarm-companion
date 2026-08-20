'use client';

import { Banner, Button } from '@bombfarm/ui';
import { sub, type Lang, type Strings } from '@/shared/i18n';
import { selectFarmRespecView, selectHeroes, usePlannerStore } from '@/shared/stores';
import { resolvePanelState } from '@/features/phases/model/farm-respec-view';
import { FarmRespecMetrics } from './farm-respec-metrics';
import { FarmRespecHeroGrid } from './farm-respec-hero-grid';
import { FarmRespecFrontier } from './farm-respec-frontier';

const PANEL_HEADING_ID = 'farm-respec-panel-heading';

/**
 * The panel that expands IN PLACE, between the toolbar and the table's rows — a plain
 * `<section>` in the normal document flow, never a modal, drawer or separate route. It renders
 * only when a fresh proposal exists or a solve is in flight/failed, AND the panel is open; a
 * stale proposal is unrenderable by construction (the selector already hid it), so this
 * component has no staleness logic of its own.
 */
export function FarmRespecPanel({ t, lang }: { t: Strings; lang: Lang }) {
  const view = usePlannerStore(selectFarmRespecView);
  const status = usePlannerStore((state) => state.farmRespecStatus);
  const panelOpen = usePlannerStore((state) => state.farmRespecPanelOpen);
  const objective = usePlannerStore((state) => state.farmObjective);
  const heroes = usePlannerStore(selectHeroes);
  const setFarmRespecPanelOpen = usePlannerStore((state) => state.setFarmRespecPanelOpen);

  const mountable = panelOpen && (view != null || status === 'solving' || status === 'failed');
  if (!mountable) return null;

  const panelState = resolvePanelState(view, status);

  return (
    // Normal document flow — not a dialog landmark, no portal, no route change. Opens downward
    // and never auto-scrolls: the intentional-disclosure exemption (no-layout-shift.md rule 5),
    // triggered by the user's own click on the Optimize control immediately above it.
    <section
      id="farm-respec-panel"
      aria-labelledby={PANEL_HEADING_ID}
      data-testid="farm-respec-panel"
      className="mb-3 flex flex-col gap-3 rounded-sm border border-line p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          id={PANEL_HEADING_ID}
          className="m-0 text-[13px] font-bold tracking-[0.03em] uppercase"
        >
          {t.farmRespecPanelHeading}
        </h3>
        <Button
          type="button"
          variant="ghost"
          data-testid="farm-respec-close"
          onClick={() => setFarmRespecPanelOpen(false)}
        >
          {t.farmRespecClose}
        </Button>
      </div>

      {panelState.kind === 'solving' ? (
        <Banner tone="warn" data-testid="farm-respec-solving">
          {t.farmRespecOptimizeBusy}
        </Banner>
      ) : panelState.kind === 'failed' ? (
        // A named failure banner with zero numeric cells and no re-rank toggle — never a blank panel.
        <Banner tone="warn" data-testid="farm-respec-failed-banner">
          {t.farmRespecFailed}
        </Banner>
      ) : panelState.kind === 'terminal' ? (
        <Banner
          tone="warn"
          title={t.farmRespecTerminalTitle}
          data-testid="farm-respec-terminal-banner"
        >
          {t.farmRespecTerminalDesc}
        </Banner>
      ) : (
        <>
          {panelState.budgetExhausted ? (
            <Banner tone="warn" data-testid="farm-respec-budget-exhausted">
              {t.farmRespecBudgetExhausted}
            </Banner>
          ) : null}
          <FarmRespecMetrics t={t} lang={lang} result={panelState.result} />
          {objective !== 'gold' ? (
            <p className="m-0 text-[11px] text-muted" data-testid="farm-respec-chest-explainer">
              {t.farmRespecChestExplainer}
            </p>
          ) : null}
          <div>
            <h4 className="m-0 mb-2 text-[11px] tracking-[0.03em] text-muted uppercase">
              {t.farmRespecHeroesHeading}
            </h4>
            <FarmRespecHeroGrid result={panelState.result} heroes={heroes} lang={lang} t={t} />
          </div>
          <FarmRespecFrontier t={t} result={panelState.result} />
          <p className="m-0 text-[10px] text-muted" data-testid="farm-respec-diagnostics">
            {sub(t.farmRespecDiagnostics, {
              evaluations: String(panelState.result.evaluations),
              sweeps: String(panelState.result.sweeps),
            })}
          </p>
        </>
      )}
    </section>
  );
}
