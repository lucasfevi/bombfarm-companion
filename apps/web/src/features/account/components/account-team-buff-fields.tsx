'use client';

import { TEAM_BUFF_FIELDS } from '@bombfarm/domain/team-buffs';
import { useAppLang } from '@/shared/context/app-lang';
import { teamBuffLabel } from '@bombfarm/domain/game-labels';
import { Fields, Num } from '@bombfarm/ui';
import { useShallow } from 'zustand/react/shallow';
import { usePlannerStore, selectTeamBuffs } from '@/shared/stores';
import { accountStackAlignClass } from '@bombfarm/ui/panel-field.recipe';

export function AccountTeamBuffFields() {
  const { lang } = useAppLang();
  const teamBuffs = usePlannerStore(useShallow(selectTeamBuffs));
  const setTeamBuffs = usePlannerStore((state) => state.setTeamBuffs);

  return (
    <Fields layout="stack" className={accountStackAlignClass}>
      {TEAM_BUFF_FIELDS.map((field) => (
        <label key={field.id}>
          <span>
            {teamBuffLabel(field.id, lang)}
            <span data-field-hint>{field.hint}</span>
          </span>
          <Num
            value={teamBuffs[field.id]}
            onChange={(value) => setTeamBuffs({ ...teamBuffs, [field.id]: value })}
            step={field.step}
          />
        </label>
      ))}
    </Fields>
  );
}
