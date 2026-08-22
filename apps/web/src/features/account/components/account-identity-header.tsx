'use client';

import { Panel } from '@bombfarm/ui';
import { panelHClass, panelTitleClass, tipClass } from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import { formatPhaseLabel } from '@/shared/lib/phase-label';
import { AccountIdentityFact } from './account-identity-fact';
import {
  usePlannerStore,
  selectAccountId,
  selectFarmPhase,
  selectMaxPhase,
  selectPlayerName,
} from '@/shared/stores';

const EM_DASH = '—';

/**
 * Who this account is and how far it has come — the four facts every panel below is scoped to.
 * All read-only and import-sourced; a save that carried no identity renders dashes rather than
 * a blank header, so "nothing imported yet" stays legible.
 */
export function AccountIdentityHeader() {
  const { t, lang } = useAppLang();
  const playerName = usePlannerStore(selectPlayerName);
  const accountId = usePlannerStore(selectAccountId);
  const phase = usePlannerStore(selectFarmPhase);
  const maxPhase = usePlannerStore(selectMaxPhase);

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.panelAccount}</h2>
      </div>
      <p className={tipClass}>{t.accountIdentityTip}</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 min-[560px]:grid-cols-4">
        <AccountIdentityFact label={t.accountPlayerName} value={playerName ?? EM_DASH} />
        <AccountIdentityFact label={t.accountIdLabel} value={accountId ?? EM_DASH} />
        <AccountIdentityFact
          label={t.accountCurrentPhase}
          value={phase != null ? formatPhaseLabel(phase, lang) : EM_DASH}
        />
        <AccountIdentityFact
          label={t.accountMaxPhase}
          value={maxPhase != null ? formatPhaseLabel(maxPhase, lang) : EM_DASH}
        />
      </div>
    </Panel>
  );
}
