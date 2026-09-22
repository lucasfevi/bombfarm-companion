'use client';

import { useMemo } from 'react';
import { SearchSelect, formatNumber } from '@bombfarm/ui';
import { sub, type Lang } from '@bombfarm/hero/copy';
import { gateWindowSecs } from '@bombfarm/domain/combat-window';
import type { TeamPlanCopy } from '../copy';
import { teamPlanGateOptions } from '../model/phase-options';
import { SetupField } from './setup-field';

/**
 * The gate a Gate clear plan fights, in the phase control's place: gate phases only, no "None",
 * because the timer the objective scores over is the gate's act's.
 */
export function GatePhaseField({
  t,
  lang,
  value,
  onChange,
}: {
  t: TeamPlanCopy;
  lang: Lang;
  /** The resolved gate — the player's pick, or the account's next gate. */
  value: number;
  onChange: (value: number) => void;
}) {
  const options = useMemo(() => teamPlanGateOptions(lang), [lang]);
  return (
    <SetupField
      label={t.teamPlanGatePhaseLabel}
      hint={sub(t.teamPlanGatePhaseHint, { secs: formatNumber(gateWindowSecs(value), lang, 0) })}
      className="min-w-52 max-w-sm flex-1"
      testId="team-plan-gate-phase"
    >
      <SearchSelect
        aria-label={t.teamPlanGatePhaseAria}
        options={options}
        value={String(value)}
        onValueChange={(next) => {
          const phase = Number.parseInt(next, 10);
          if (Number.isFinite(phase)) onChange(phase);
        }}
        searchPlaceholder={t.teamPlanGatePhaseSearchPlaceholder}
        emptyLabel={t.teamPlanPhaseNoMatch}
        overflowLabel={(shown, matched) =>
          sub(t.teamPlanPhaseMoreMatches, {
            shown: formatNumber(shown, lang, 0),
            matched: formatNumber(matched, lang, 0),
          })
        }
      />
    </SetupField>
  );
}
