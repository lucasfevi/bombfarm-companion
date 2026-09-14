'use client';

import { houseLabel } from '@bombfarm/domain/game-labels';
import { HOUSE_MAX_LEVEL, resolveHouseRestSeconds } from '@bombfarm/domain/model';
import { formatPhaseLabel } from '@bombfarm/farm/model/farm-ranking-format';
import { formatHouseRest, useAccountHoldings } from '@/features/account';
import { useAppLang } from '@/shared/context/app-lang';
import { useMarketSnapshot } from '@/shared/hooks/use-market-snapshot';
import { formatMoney, sub } from '@/shared/i18n';
import {
  selectFarmPhase,
  selectHouseCycleSecs,
  selectHouseCycleSecsHouseIdx,
  selectHouseCycleSecsLevel,
  selectHouseIdx,
  selectHouseLevel,
  selectMaxPhase,
  selectSlots,
  usePlannerStore,
} from '@/shared/stores';
import { selectAccountUsable } from '../model/home-selectors';
import { HomeKeyValues } from './home-key-values';
import { HomeSectionCard } from './home-section-card';

export function AccountCard() {
  const { t, lang } = useAppLang();
  const accountUsable = usePlannerStore(selectAccountUsable);
  const phase = usePlannerStore(selectFarmPhase);
  const maxPhase = usePlannerStore(selectMaxPhase);
  const houseIdx = usePlannerStore(selectHouseIdx);
  const houseLevel = usePlannerStore(selectHouseLevel);
  const slots = usePlannerStore(selectSlots);
  const houseCycleSecs = usePlannerStore(selectHouseCycleSecs);
  const cycleHouseIdx = usePlannerStore(selectHouseCycleSecsHouseIdx);
  const cycleLevel = usePlannerStore(selectHouseCycleSecsLevel);
  const holdings = useAccountHoldings();
  const { snapshot } = useMarketSnapshot();

  const restSeconds = resolveHouseRestSeconds(houseCycleSecs, houseIdx, houseLevel, cycleHouseIdx, cycleLevel);
  const rows: [string, string][] = [
    [
      t.homeCardAccountValue,
      snapshot == null ? t.accountHoldingsUnpriced : formatMoney(holdings.total, lang, holdings.currency),
    ],
    [t.accountCurrentPhase, phase == null ? '—' : formatPhaseLabel(phase, lang)],
    [t.accountMaxPhase, maxPhase == null ? '—' : formatPhaseLabel(maxPhase, lang)],
    [t.house, sub(t.homeCardAccountHouse, { house: houseLabel(houseIdx, lang), level: houseLevel, max: HOUSE_MAX_LEVEL })],
    [t.accountCasaSlots, String(slots)],
    [t.accountHouseCycle, formatHouseRest(restSeconds)],
  ];

  return (
    <HomeSectionCard
      section="account"
      state={accountUsable ? 'ready' : 'needs'}
      context={t.homeCardAccountContext}
      footer={accountUsable ? null : t.homeCardAccountNeeds}
    >
      <HomeKeyValues rows={rows} testId="home-account" />
    </HomeSectionCard>
  );
}
