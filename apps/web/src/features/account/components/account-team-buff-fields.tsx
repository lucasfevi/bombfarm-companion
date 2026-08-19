'use client';

import { TEAM_BUFF_FIELDS } from '@bombfarm/domain/team-buffs';
import { useAppLang } from '@/shared/context/app-lang';
import { teamBuffLabel } from '@bombfarm/domain/game-labels';
import { Fields, Num } from '@bombfarm/ui';
import { useShallow } from 'zustand/react/shallow';
import { usePlannerStore, selectEffectiveTeamBuffs } from '@/shared/stores';
import { accountStackAlignClass } from '@bombfarm/ui/panel-field.recipe';

/**
 * Shows the EFFECTIVE roster-wide total (issue #132) — an explicit override when one is set,
 * else derived from the deployed roster — so a fresh account shows real, non-zero numbers for
 * whichever auras its roster actually carries, not a blank/zero panel waiting for a button press.
 * Editing any field seeds a NEW override from that same effective snapshot with the one field
 * changed, rather than from a stale base.
 */
export function AccountTeamBuffFields() {
  const { lang } = useAppLang();
  const teamBuffs = usePlannerStore(useShallow(selectEffectiveTeamBuffs));
  const setTeamBuffsOverride = usePlannerStore((state) => state.setTeamBuffsOverride);

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
            onChange={(value) => setTeamBuffsOverride({ ...teamBuffs, [field.id]: value })}
            step={field.step}
          />
        </label>
      ))}
    </Fields>
  );
}
