'use client';

import { Banner, Switch } from '@bombfarm/ui';
import type { Strings } from '@/shared/i18n';
import { selectFarmReRankActive, usePlannerStore } from '@/shared/stores';

/**
 * Always-mounted directly above the ranking table (never inside the collapsible panel) — turning
 * it on closes the panel, so the toggle must stay reachable to turn back off. `selectFarmReRankActive`
 * already reads `false` whenever no fresh proposal exists, so this component has no staleness
 * logic of its own. When active, the same control renders inside a Banner (the primitive only
 * offers `warn`/`ok` tones; `ok` reads as the calmer, non-alarming choice for an informational
 * mode marker) — one of three independent, non-colour signals marking the table as showing a
 * hypothetical build.
 */
export function FarmRespecRerankToggle({ t }: { t: Strings }) {
  const active = usePlannerStore(selectFarmReRankActive);
  const setFarmRespecReRank = usePlannerStore((state) => state.setFarmRespecReRank);

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
