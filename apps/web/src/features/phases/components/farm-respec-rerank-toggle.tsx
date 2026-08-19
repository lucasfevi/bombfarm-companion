'use client';

import { Banner, Switch } from '@bombfarm/ui';
import type { Strings } from '@/shared/i18n';
import { selectFarmReRankActive, selectFarmRespecView, usePlannerStore } from '@/shared/stores';

/**
 * Always-mounted directly above the ranking table (never inside the collapsible panel) — turning
 * it on closes the panel, so the toggle must stay reachable to turn back off. Rendered only once
 * `selectFarmRespecView` has a fresh proposal to show, i.e. Optimize has actually run — NOT gated
 * on `farmRespecPanelOpen`, so collapsing the panel (`FarmRespecPanel`'s own visibility input)
 * never hides this control while a proposal is still live. `selectFarmReRankActive` already
 * reads `false` whenever no fresh proposal exists, so the active state has no staleness logic of
 * its own either. When active, the same control renders inside a Banner (the primitive only
 * offers `warn`/`ok` tones; `ok` reads as the calmer, non-alarming choice for an informational
 * mode marker) — one of three independent, non-colour signals marking the table as showing a
 * hypothetical build.
 */
export function FarmRespecRerankToggle({ t }: { t: Strings }) {
  const hasProposal = usePlannerStore(selectFarmRespecView) != null;
  const active = usePlannerStore(selectFarmReRankActive);
  const setFarmRespecReRank = usePlannerStore((state) => state.setFarmRespecReRank);

  if (!hasProposal) return null;

  const toggle = (
    <label data-testid="farm-respec-rerank" className="flex items-center gap-2 text-[11px]">
      <Switch
        checked={active}
        onCheckedChange={setFarmRespecReRank}
        aria-label={t.farmRespecRerankToggle}
      />
      <span>{t.farmRespecRerankToggle}</span>
    </label>
  );

  if (!active) return <div className="mb-2 flex justify-end">{toggle}</div>;

  return (
    <Banner tone="ok" data-testid="farm-respec-rerank-banner" className="mb-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{t.farmRespecRerankBanner}</span>
        {toggle}
      </div>
    </Banner>
  );
}
