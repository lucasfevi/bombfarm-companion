'use client';

import { HelpTip, Select, Switch } from '@bombfarm/ui';
import type { Strings } from '@/shared/i18n';
import type { FarmFilters, GateFilter } from '@/features/phases/model/farm-ranking-view';

type Props = {
  filters: FarmFilters;
  onChange: (next: FarmFilters) => void;
  /** `false` when `maxPhase` is `null` — the unlocked-only control is non-applicable. */
  maxPhaseKnown: boolean;
  t: Strings;
};

const fieldLabelClass = 'flex flex-col gap-[3px] text-[11px] tracking-[0.03em] text-muted uppercase';

/** `Switch` x2 (unlocked-only, feasible-only) + `Select` x2 (ato, gate). */
export function FarmRankingFilters({ filters, onChange, maxPhaseKnown, t }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* `<div>`, not `<label>` — wrapping a Switch in a native <label> makes the browser (and
          Playwright's click actionability) forward clicks/focus to Base UI's visually-hidden
          native <input type="checkbox">, which sits off-screen via clip-path and reads as
          "not enabled". The Switch's own `aria-label` already carries the accessible name
          (the same pattern `HeroActiveToggle` uses). */}
      <div className={fieldLabelClass} data-testid="farm-filter-unlocked">
        <span className="flex items-center gap-1">
          {t.farmRankingFilterUnlockedLabel}
          <HelpTip
            label={t.farmRankingFilterUnlockedDisabledReason}
            show={!maxPhaseKnown}
          >
            {t.farmRankingFilterUnlockedDisabledReason}
          </HelpTip>
        </span>
        <Switch
          checked={maxPhaseKnown && filters.unlockedOnly}
          disabled={!maxPhaseKnown}
          onCheckedChange={(checked) => onChange({ ...filters, unlockedOnly: checked })}
          aria-label={t.farmRankingFilterUnlockedLabel}
        />
      </div>

      <div className={fieldLabelClass} data-testid="farm-filter-feasible">
        <span>{t.farmRankingFilterFeasibleLabel}</span>
        <Switch
          checked={filters.feasibleOnly}
          onCheckedChange={(checked) => onChange({ ...filters, feasibleOnly: checked })}
          aria-label={t.farmRankingFilterFeasibleLabel}
        />
      </div>

      <label className={`${fieldLabelClass} w-36 shrink-0`} data-testid="farm-filter-ato">
        <span>{t.farmRankingFilterAtoLabel}</span>
        <Select
          size="compact"
          className="w-full"
          aria-label={t.farmRankingFilterAtoLabel}
          value={filters.ato == null ? '' : String(filters.ato)}
          onChange={(event) =>
            onChange({ ...filters, ato: event.target.value === '' ? null : Number(event.target.value) })
          }
        >
          <option value="">{t.farmRankingFilterAtoAll}</option>
          {[1, 2, 3, 4, 5].map((ato) => (
            <option key={ato} value={ato}>
              {ato}
            </option>
          ))}
        </Select>
      </label>

      <label className={`${fieldLabelClass} w-40 shrink-0`} data-testid="farm-filter-gate">
        <span>{t.farmRankingFilterGateLabel}</span>
        <Select
          size="compact"
          className="w-full"
          aria-label={t.farmRankingFilterGateLabel}
          value={filters.gate}
          onChange={(event) => onChange({ ...filters, gate: event.target.value as GateFilter })}
        >
          <option value="all">{t.farmRankingFilterGateAll}</option>
          <option value="gate">{t.farmRankingFilterGateOnly}</option>
          <option value="non-gate">{t.farmRankingFilterGateNonGate}</option>
        </Select>
      </label>
    </div>
  );
}
