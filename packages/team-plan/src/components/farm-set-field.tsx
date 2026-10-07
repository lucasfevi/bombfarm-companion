'use client';

import { useMemo } from 'react';
import { Select } from '@bombfarm/ui';
import type { Lang } from '@bombfarm/hero/copy';
import type { TeamPlanCopy } from '../copy';
import { teamPlanFarmSetOptions } from '../model/set-farm-options';
import { SetupField } from './setup-field';

const NO_SET = '';

/** The set a Set farm plan collects, in the phase control's place: the set decides the phases. */
export function FarmSetField({
  t,
  lang,
  value,
  maxPhase,
  onChange,
}: {
  t: TeamPlanCopy;
  lang: Lang;
  value: string | null;
  maxPhase: number | null;
  onChange: (value: string | null) => void;
}) {
  const options = useMemo(() => teamPlanFarmSetOptions(t, lang, maxPhase), [t, lang, maxPhase]);
  return (
    <SetupField
      label={t.teamPlanFarmSetLabel}
      hint={t.teamPlanFarmSetHint}
      className="min-w-52 max-w-sm flex-1"
      testId="team-plan-farm-set"
    >
      <Select
        aria-label={t.teamPlanFarmSetAria}
        value={value ?? NO_SET}
        onChange={(event) => {
          const next: string = event.target.value;
          onChange(next === NO_SET ? null : next);
        }}
      >
        <option value={NO_SET} disabled>
          {t.teamPlanFarmSetPlaceholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.unreached}>
            {option.label}
          </option>
        ))}
      </Select>
    </SetupField>
  );
}
