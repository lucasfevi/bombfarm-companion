'use client';

import { HelpTip, Select, Switch } from '@bombfarm/ui';
import { gameDifficultyLabel, ITEM_LEVEL_TIERS } from '@bombfarm/domain/phase-wiki';
import { sub, type Lang } from '@bombfarm/hero/copy';
import type { FarmCopy } from '../copy';
import type { FarmFilters, GateFilter } from '../model/farm-ranking-view';

type Props = {
  filters: FarmFilters;
  onChange: (next: FarmFilters) => void;
  /** `false` when `maxPhase` is `null` — the unlocked-only control is non-applicable. */
  maxPhaseKnown: boolean;
  lang: Lang;
  t: FarmCopy;
};

export const farmFieldClass = 'flex flex-col gap-[3px]';

/**
 * Fixed heights, not intrinsic ones: the label band must not grow when a field carries a
 * `HelpTip`, and the control band is the 26px compact `Select` so the 22px `Switch` centres
 * against it. Without both, fields of unequal height leave the labels on ragged baselines.
 */
export const farmFieldLabelClass =
  'flex h-4 items-center gap-1 text-[11px] leading-none tracking-[0.03em] text-muted uppercase';
export const farmFieldControlClass = 'flex h-[26px] items-center';

/** `Switch` x1 (unlocked-only) + `Select` x3 (ato, gate, minimum item level). */
export function FarmRankingFilters({ filters, onChange, maxPhaseKnown, lang, t }: Props) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      {/* `<div>`, not `<label>` — wrapping a Switch in a native <label> makes the browser (and
          Playwright's click actionability) forward clicks/focus to Base UI's visually-hidden
          native <input type="checkbox">, which sits off-screen via clip-path and reads as
          "not enabled". The Switch's own `aria-label` already carries the accessible name
          (the same pattern `HeroActiveToggle` uses). */}
      <div className={farmFieldClass} data-testid="farm-filter-unlocked">
        <span className={farmFieldLabelClass}>
          {t.farmRankingFilterUnlockedLabel}
          <HelpTip label={t.farmRankingFilterUnlockedDisabledReason} show={!maxPhaseKnown}>
            {t.farmRankingFilterUnlockedDisabledReason}
          </HelpTip>
        </span>
        <div className={farmFieldControlClass}>
          <Switch
            checked={maxPhaseKnown && filters.unlockedOnly}
            disabled={!maxPhaseKnown}
            onCheckedChange={(checked) => onChange({ ...filters, unlockedOnly: checked })}
            aria-label={t.farmRankingFilterUnlockedLabel}
          />
        </div>
      </div>

      <label className={`${farmFieldClass} w-36 shrink-0`} data-testid="farm-filter-ato">
        <span className={farmFieldLabelClass}>{t.farmRankingFilterAtoLabel}</span>
        <div className={farmFieldControlClass}>
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
                {gameDifficultyLabel(ato, lang)}
              </option>
            ))}
          </Select>
        </div>
      </label>

      <label className={`${farmFieldClass} w-40 shrink-0`} data-testid="farm-filter-gate">
        <span className={farmFieldLabelClass}>{t.farmRankingFilterGateLabel}</span>
        <div className={farmFieldControlClass}>
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
        </div>
      </label>

      <label className={`${farmFieldClass} w-44 shrink-0`} data-testid="farm-filter-item-level">
        <span className={farmFieldLabelClass}>{t.farmRankingFilterItemLevelLabel}</span>
        <div className={farmFieldControlClass}>
          <Select
            size="compact"
            className="w-full"
            aria-label={t.farmRankingFilterItemLevelLabel}
            value={filters.minItemLevel == null ? '' : String(filters.minItemLevel)}
            onChange={(event) =>
              onChange({
                ...filters,
                minItemLevel: event.target.value === '' ? null : Number(event.target.value),
              })
            }
          >
            <option value="">{t.farmRankingFilterItemLevelAll}</option>
            {ITEM_LEVEL_TIERS.map((level) => (
              <option key={level} value={level}>
                {sub(t.farmRankingFilterItemLevelOption, { level: String(level) })}
              </option>
            ))}
          </Select>
        </div>
      </label>
    </div>
  );
}
