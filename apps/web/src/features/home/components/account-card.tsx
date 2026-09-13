'use client';

import { HOLDINGS_COMPONENTS, type HoldingsComponentView } from '@bombfarm/account/holdings';
import { houseLabel } from '@bombfarm/domain/game-labels';
import { HOUSES, HOUSE_MAX_LEVEL, resolveHouseRestSeconds } from '@bombfarm/domain/model';
import { formatPhaseLabel } from '@bombfarm/farm/model/farm-ranking-format';
import { cn } from '@bombfarm/ui';
import { mutedClass } from '@bombfarm/ui/panel-field.recipe';
import {
  formatHouseRest,
  formatLuckPoints,
  formatTreePercent,
  useAccountHoldings,
} from '@/features/account';
import { useAppLang } from '@/shared/context/app-lang';
import { useMarketSnapshot } from '@/shared/hooks/use-market-snapshot';
import { formatMoney, sub } from '@/shared/i18n';
import {
  selectFarmPhase,
  selectFieldSlots,
  selectHouseCycleSecs,
  selectHouseCycleSecsHouseIdx,
  selectHouseCycleSecsLevel,
  selectHouseIdx,
  selectHouseLevel,
  selectMaxPhase,
  selectSlots,
  selectTreeLuckFlatPct,
  selectTreeSquadDmgPct,
  usePlannerStore,
} from '@/shared/stores';
import { selectAccountUsable } from '../model/home-selectors';
import { HomeSectionCard } from './home-section-card';

export function AccountCard() {
  const { t, lang } = useAppLang();
  const accountUsable = usePlannerStore(selectAccountUsable);
  const phase = usePlannerStore(selectFarmPhase);
  const maxPhase = usePlannerStore(selectMaxPhase);
  const houseIdx = usePlannerStore(selectHouseIdx);
  const houseLevel = usePlannerStore(selectHouseLevel);
  const slots = usePlannerStore(selectSlots);
  const fieldSlots = usePlannerStore(selectFieldSlots);
  const houseCycleSecs = usePlannerStore(selectHouseCycleSecs);
  const cycleHouseIdx = usePlannerStore(selectHouseCycleSecsHouseIdx);
  const cycleLevel = usePlannerStore(selectHouseCycleSecsLevel);
  const squadDmgPct = usePlannerStore(selectTreeSquadDmgPct);
  const luckFlatPct = usePlannerStore(selectTreeLuckFlatPct);
  const holdings = useAccountHoldings();
  const { snapshot } = useMarketSnapshot();

  const restSeconds = resolveHouseRestSeconds(houseCycleSecs, houseIdx, houseLevel, cycleHouseIdx, cycleLevel);
  const rows: [string, string][] = [
    [t.accountCurrentPhase, phase == null ? '—' : formatPhaseLabel(phase, lang)],
    [t.accountMaxPhase, maxPhase == null ? '—' : formatPhaseLabel(maxPhase, lang)],
    [t.house, `${houseLabel(houseIdx, lang)} · ${t.houseLevelLabel} ${houseLevel} / ${HOUSE_MAX_LEVEL}`],
    [t.accountHouseCycle, formatHouseRest(restSeconds)],
    [t.accountCasaSlots, String(slots)],
    [t.accountFieldSlots, fieldSlots == null ? '—' : String(fieldSlots)],
    [t.accountSquadDmg, formatTreePercent(squadDmgPct, lang)],
    [t.accountLuckFlat, formatLuckPoints(luckFlatPct, lang)],
  ];

  const money = (amount: number) =>
    snapshot == null ? t.accountHoldingsUnpriced : formatMoney(amount, lang, holdings.currency);
  const componentValue = (
    componentId: (typeof HOLDINGS_COMPONENTS)[number],
    component: HoldingsComponentView,
  ) => (component.withheld ? holdings.labels.components[componentId].withheld : money(component.amount));
  const partial = HOLDINGS_COMPONENTS.some((componentId) => holdings[componentId].withheld);
  const nextHouseIdx = houseIdx + 1;

  return (
    <HomeSectionCard
      section="account"
      state={accountUsable ? 'ready' : 'needs'}
      context={t.homeCardAccountContext}
      footer={
        accountUsable
          ? nextHouseIdx < HOUSES.length
            ? sub(t.accountNextHouse, { house: houseLabel(nextHouseIdx, lang) })
            : t.accountHouseTipMaxed
          : t.homeCardAccountNeeds
      }
    >
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className={mutedClass} data-testid="home-account-label">
              {label}
            </dt>
            <dd className="m-0 font-mono tabular-nums" data-testid="home-account-value">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className={cn('m-0 mt-3 text-xs', mutedClass)}>{t.accountHoldingsTotal}</p>
      <p className="m-0 flex flex-wrap items-baseline gap-x-2">
        <span
          className="font-mono text-2xl leading-none font-bold tabular-nums text-accent"
          data-testid="home-account-total"
        >
          {money(holdings.total)}
        </span>
        {partial ? (
          <span className="text-xs text-warn" data-testid="home-account-partial">
            {holdings.labels.partial}
          </span>
        ) : null}
      </p>
      <dl className="m-0 mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {HOLDINGS_COMPONENTS.map((componentId) => (
          <div key={componentId} className="contents">
            <dt className={mutedClass}>{holdings.labels.components[componentId].title}</dt>
            <dd className="m-0 font-mono tabular-nums" data-testid={`home-account-${componentId}`}>
              {componentValue(componentId, holdings[componentId])}
            </dd>
          </div>
        ))}
      </dl>
    </HomeSectionCard>
  );
}
