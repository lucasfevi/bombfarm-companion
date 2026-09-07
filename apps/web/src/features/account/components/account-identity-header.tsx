'use client';

import { AccountIdentityView } from '@bombfarm/account/panels';
import { useAppLang } from '@/shared/context/app-lang';
import { formatPhaseLabel } from '@/shared/lib/phase-label';
import {
  usePlannerStore,
  selectAccountId,
  selectFarmPhase,
  selectMaxPhase,
  selectPlayerName,
} from '@/shared/stores';

const EM_DASH = '—';

export function AccountIdentityHeader() {
  const { t, lang } = useAppLang();
  const playerName = usePlannerStore(selectPlayerName);
  const accountId = usePlannerStore(selectAccountId);
  const phase = usePlannerStore(selectFarmPhase);
  const maxPhase = usePlannerStore(selectMaxPhase);

  return (
    <AccountIdentityView
      playerName={playerName}
      accountId={accountId}
      phase={phase}
      maxPhase={maxPhase}
      labels={{
        title: t.panelAccount,
        tip: t.accountIdentityTip,
        playerName: t.accountPlayerName,
        accountId: t.accountIdLabel,
        currentPhase: t.accountCurrentPhase,
        maxPhase: t.accountMaxPhase,
        phase: (phaseNumber) => formatPhaseLabel(phaseNumber, lang),
        missing: EM_DASH,
      }}
    />
  );
}
