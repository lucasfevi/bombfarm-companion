'use client';

import { useMemo } from 'react';
import {
  Button,
  Panel,
  SearchSelect,
  formatNumber,
  panelHClass,
  panelTitleClass,
  selectFieldHeightClass,
} from '@bombfarm/ui';
import { heroCopyFor, sub, type Lang } from '@bombfarm/hero/copy';
import { phaseFromSearchValue, phaseSearchOptions, phaseSearchValue } from '../model/phase-options';

const fieldLabelClass =
  'flex w-full max-w-sm min-w-0 flex-col gap-[3px] text-[11px] tracking-[0.03em] text-muted uppercase';

/**
 * The phase a hero's combat figures are computed at, and the way back to the one the host would
 * have chosen on its own.
 *
 * The same searchable picker the team optimizer plans with, so a player who has learned to type
 * `Hard 1-1` or `151` there finds the same control here. `overridden` is the host's reading of
 * whether a pick is in force: the button is dead while there is nothing to go back to.
 */
export function CombatPhasePanel({
  phase,
  overridden,
  onOverridePhase,
  onClearOverride,
  lang,
}: {
  phase: number;
  overridden: boolean;
  onOverridePhase: (phase: number) => void;
  onClearOverride: () => void;
  lang: Lang;
}) {
  const t = heroCopyFor(lang);
  const options = useMemo(() => phaseSearchOptions(lang), [lang]);

  return (
    <Panel focus>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.heroDetailPhaseTitle}</h2>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className={fieldLabelClass}>
          <span>{t.heroDetailPhaseLabel}</span>
          <SearchSelect
            aria-label={t.heroDetailPhaseAria}
            options={options}
            value={phaseSearchValue(phase)}
            onValueChange={(next) => {
              const picked = phaseFromSearchValue(next);
              if (picked !== null) onOverridePhase(picked);
            }}
            searchPlaceholder={t.heroDetailPhaseSearchPlaceholder}
            emptyLabel={t.heroDetailPhaseNoMatch}
            overflowLabel={(shown, matched) =>
              sub(t.heroDetailPhaseMoreMatches, {
                shown: formatNumber(shown, lang, 0),
                matched: formatNumber(matched, lang, 0),
              })
            }
          />
        </label>
        <Button
          variant="ghost"
          className={selectFieldHeightClass}
          onClick={onClearOverride}
          disabled={!overridden}
        >
          {t.heroDetailPhaseUseCurrent}
        </Button>
      </div>
    </Panel>
  );
}
