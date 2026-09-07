/**
 * Every string and formatter the shared Account panels ask for, built from this app's own copy
 * layer. The views in `@bombfarm/account/panels` take a label bag and never see a language, so
 * this module is the whole of the translation — the screen beside it is layout.
 */
import type {
  AccountHouseLabels,
  AccountIdentityLabels,
  AccountTreeLabels,
} from '@bombfarm/account/panels';
import type { HoldingsComponentId, HoldingsLabels } from '@bombfarm/account/holdings';
import { formatNumber } from '@bombfarm/ui';
import { houseLabel } from '@bombfarm/domain/game-labels';
import { formatPhaseLabel } from '@bombfarm/farm';
import type { AppLocale, DomainLang } from '@bombfarm/contracts';
import { sub, type Copy } from '../../lib/copy';
import { formatMoney } from '../../lib/format';
import { formatLiveDurationSeconds } from '../live/format-live-duration';

/** What the panels print where the account carried no value at all. */
const EM_DASH = '—';

const MINUS_SIGN = '−';

/** A signed `m:ss`, in the same shape the Live screen's own countdowns use. */
function signedDuration(deltaSeconds: number): string {
  const sign = deltaSeconds < 0 ? MINUS_SIGN : '+';
  return `${sign}${formatLiveDurationSeconds(Math.abs(deltaSeconds))}`;
}

function signedCount(delta: number): string {
  return delta > 0 ? `+${String(delta)}` : `${MINUS_SIGN}${String(Math.abs(delta))}`;
}

export function accountIdentityLabels(t: Copy, lang: DomainLang): AccountIdentityLabels {
  return {
    title: t.accountPanelTitle,
    tip: t.accountIdentityTip,
    playerName: t.accountPlayerName,
    accountId: t.accountIdLabel,
    currentPhase: t.accountCurrentPhase,
    maxPhase: t.accountMaxPhase,
    phase: (phase) => formatPhaseLabel(phase, lang),
    missing: EM_DASH,
  };
}

export function accountHouseLabels(t: Copy, lang: DomainLang): AccountHouseLabels {
  return {
    title: t.accountHouse,
    tip: t.accountHouseTip,
    tipMaxed: t.accountHouseTipMaxed,
    house: t.accountHouse,
    level: t.accountHouseLevel,
    cycle: t.accountHouseCycle,
    cycleTip: t.accountHouseCycleTip,
    slots: t.accountHouseSlots,
    slotsTip: t.accountHouseSlotsTip,
    houseName: (houseIndex) => houseLabel(houseIndex, lang),
    nextHouseHeading: (houseName) => sub(t.accountNextHouse, { house: houseName }),
    levelOfMax: (level, maxLevel) => `${String(level)} / ${String(maxLevel)}`,
    cycleDuration: formatLiveDurationSeconds,
    cycleDelta: signedDuration,
    slotsDelta: signedCount,
  };
}

export function accountTreeLabels(t: Copy, lang: DomainLang): AccountTreeLabels {
  return {
    title: t.accountTreePanelTitle,
    tip: t.accountTreeTip,
    groupDamage: t.accountTreeGroupDamage,
    groupField: t.accountTreeGroupField,
    groupRewards: t.accountTreeGroupRewards,
    squadDamage: t.accountSquadDamage,
    geoMultiplier: t.accountGeoMultiplier,
    totalDamage: t.accountTotalDamage,
    critChance: t.accountCritChance,
    critDamage: t.accountCritDamage,
    speed: t.accountSpeed,
    energy: t.accountEnergy,
    fieldSlots: t.accountFieldSlots,
    fieldSlotsTip: t.accountFieldSlotsTip,
    gold: t.accountGold,
    goldTip: t.accountGoldTip,
    luck: t.accountLuck,
    xp: t.accountXp,
    bagTabs: t.accountBagTabs,
    percent: (value) => `+${formatNumber(value, lang, 2)}%`,
    multiplier: (value) => `×${formatNumber(value, lang, 3)}`,
    luckPoints: (value) => `+${formatNumber(value, lang, 2)} pp`,
    bonus: (value) => `+${String(value)}`,
    totalDamageTip: (squadDamagePct, geoMultiplier, total) =>
      sub(t.accountTotalDamageTip, {
        squad: formatNumber(squadDamagePct, lang, 2),
        geo: formatNumber(geoMultiplier, lang, 3),
        total: formatNumber(total, lang, 3),
      }),
    bonusOfTotal: (bonus, total) =>
      sub(t.accountBonusOfTotal, { bonus: `+${String(bonus)}`, total: String(total) }),
  };
}

export function accountHoldingsLabels(t: Copy, locale: AppLocale): HoldingsLabels {
  const titles: Record<HoldingsComponentId, string> = {
    inventory: t.accountHoldingsInventory,
    heroes: t.accountHoldingsHeroes,
    skins: t.accountHoldingsSkins,
  };
  const component = (componentId: HoldingsComponentId, coverage: string, withheld: string) => ({
    title: titles[componentId],
    coverage: (priced: number, eligible: number) => sub(coverage, { priced, eligible }),
    withheld,
  });

  return {
    title: t.accountHoldingsTotal,
    partial: t.accountHoldingsPartial,
    amount: (value, currency) => formatMoney(value, locale, currency),
    coverage: (priced, eligible) => sub(t.accountHoldingsCoverage, { priced, eligible }),
    missing: (components) =>
      sub(t.accountHoldingsMissing, {
        rows: components.map((componentId) => titles[componentId]).join(', '),
      }),
    components: {
      inventory: component(
        'inventory',
        t.accountHoldingsInventoryCoverage,
        t.accountHoldingsInventoryWithheld,
      ),
      heroes: component('heroes', t.accountHoldingsHeroesCoverage, t.accountHoldingsHeroesWithheld),
      skins: component('skins', t.accountHoldingsSkinsCoverage, t.accountHoldingsSkinsWithheld),
    },
    unpriced: t.accountHoldingsUnpriced,
    heroesAreAFloor: t.accountHoldingsHeroesFloor,
    skinsCountedWhileWorn: t.accountHoldingsSkinsWorn,
  };
}
