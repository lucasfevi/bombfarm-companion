import { BCP47_BY_LOCALE, type AccountSource, type AppLocale, type DomainLang } from '@bombfarm/contracts';
import { FORGE_MAX, FORGE_SAFE, forgeChance, forgeRollCost } from '@bombfarm/domain/forge';
import { upgradeMult } from '@bombfarm/domain/gear';
import { itemRarityLabel, itemStatLabel, slotLabel } from '@bombfarm/domain/game-labels';
import type { InventoryViewItem, InventoryViewStat } from '@bombfarm/domain/inventory-view';
import { sub, type Copy } from '../../lib/copy';
import { formatCount, formatGainPct } from '../../lib/format';
import type { ForgeMinForge } from '../../lib/forge/forge-rows';
import { inventoryLabels } from '../inventory/inventory-labels';

export const BLANK = '—';

/** A forge level as the game prints it. */
export function forgeLevel(upgrade: number): string {
  return `+${String(upgrade)}`;
}

export type ForgeButtonReason = 'maxed' | 'fixture' | 'switch-off' | 'not-yet';

/**
 * Why the Forge button is disabled, first reason that applies. A piece with nowhere to go beats
 * everything; an account with no server behind it beats the switch, because turning the switch on
 * would not help; and the switch beats the release note for the same reason.
 */
export function forgeButtonReason(input: {
  upgrade: number;
  accountSource: AccountSource | null;
  forgeWritesEnabled: boolean;
}): ForgeButtonReason {
  if (input.upgrade >= FORGE_MAX) return 'maxed';
  if (input.accountSource === 'fixture') return 'fixture';
  if (!input.forgeWritesEnabled) return 'switch-off';
  return 'not-yet';
}

export function forgeReasonText(reason: ForgeButtonReason, t: Copy): string {
  switch (reason) {
    case 'maxed':
      return sub(t.forgeReasonMaxed, { max: forgeLevel(FORGE_MAX) });
    case 'fixture':
      return t.forgeReasonFixture;
    case 'switch-off':
      return sub(t.forgeReasonSwitchOff, { switch: t.settingsForgeWritesLabel });
    case 'not-yet':
      return t.forgeReasonNotYet;
  }
}

export function forgeMinForgeText(min: ForgeMinForge, t: Copy): string {
  if (min === 0) return t.forgeMinAny;
  if (min === FORGE_MAX) return sub(t.forgeMinOnly, { level: forgeLevel(min) });
  return sub(t.forgeMinAndUp, { level: forgeLevel(min) });
}

export type ForgeStatRow = {
  code: number;
  label: string;
  now: string;
  target: string;
  change: string;
  direction: 'up' | 'down' | 'none';
};

function decimals(value: number, digits: number, locale: AppLocale): string {
  return value.toLocaleString(BCP47_BY_LOCALE[locale], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function statText(stat: InventoryViewStat, value: number, locale: AppLocale, signed: boolean): string {
  const shown = stat.unit === 'flat' ? decimals(value, 1, locale) : `${decimals(value * 100, 2, locale)}%`;
  if (!signed) return shown;
  return value < 0 ? `−${shown.replace(/^-/, '')}` : `+${shown}`;
}

/**
 * The forge multiplier is flat, so a roll at the target is the roll now scaled by the ratio of the
 * two multipliers — exact, not a projection. A change too small to print is shown as none.
 */
export function forgeStatRows(
  stats: readonly InventoryViewStat[],
  nowUpgrade: number,
  targetUpgrade: number,
  lang: DomainLang,
  locale: AppLocale,
): ForgeStatRow[] {
  const ratio = upgradeMult(targetUpgrade) / upgradeMult(nowUpgrade);
  return stats.map((stat) => {
    const target = stat.effective * ratio;
    const change = target - stat.effective;
    const printed = statText(stat, change, locale, true);
    const none = /^[+−]0(?:[.,]0+)?%?$/.test(printed);
    return {
      code: stat.code,
      label: stat.name ? itemStatLabel(stat.name, lang) : String(stat.code),
      now: statText(stat, stat.effective, locale, false),
      target: statText(stat, target, locale, false),
      change: none ? BLANK : printed,
      direction: none ? 'none' : change > 0 ? 'up' : 'down',
    };
  });
}

export interface ForgeLabels {
  itemName: (item: InventoryViewItem) => string;
  searchText: (item: InventoryViewItem) => string;
  slotName: (slot: string | null) => string;
  rarityName: (rarityIdx: number) => string;
  /** `Rarity · Slot · nvLEVEL · +N` — the piece in one line under its name. */
  itemMeta: (item: InventoryViewItem) => string;
  whereabouts: (item: InventoryViewItem, heroName: string | null) => string;
  gold: (amount: number) => string;
  count: (value: number) => string;
  rolls: (value: number) => string;
  multiplier: (upgrade: number) => string;
  /** A chance as the game prints it: `50%`. */
  chance: (fraction: number) => string;
  /** A signed DPS change: `+3.1%`. */
  gain: (fraction: number) => string;
  /** The `+1 buys` tooltip for one worn row. */
  buysTip: (item: InventoryViewItem, delta: number) => string;
  minForge: (min: ForgeMinForge) => string;
  span: (target: number) => string;
  warning: (target: number, safeJumps: number | null) => string;
  statsNote: (nowUpgrade: number, targetUpgrade: number) => string;
}

export function forgeLabels(t: Copy, lang: DomainLang, locale: AppLocale): ForgeLabels {
  const inventory = inventoryLabels(t, lang);
  const bcp47 = BCP47_BY_LOCALE[locale];
  const chance = (fraction: number) =>
    new Intl.NumberFormat(bcp47, { style: 'percent', maximumFractionDigits: 0 }).format(fraction);
  const gold = (amount: number) => formatCount(amount, locale);
  const multiplier = (upgrade: number) => decimals(upgradeMult(upgrade), 2, locale);

  return {
    itemName: inventory.itemName,
    searchText: inventory.searchText,
    slotName: (slot) => (slot === null ? BLANK : slotLabel(slot, lang)),
    rarityName: (rarityIdx) => itemRarityLabel(rarityIdx, lang),
    itemMeta: (item) =>
      [
        itemRarityLabel(item.rarityIdx, lang),
        item.slot === null ? BLANK : slotLabel(item.slot, lang),
        `nv${String(item.level)}`,
        forgeLevel(item.upgrade),
      ].join(' · '),
    whereabouts: (item, heroName) => {
      const power = formatCount(item.power, locale);
      if (item.equippedBy !== null) {
        return sub(t.forgeWornBy, { power, hero: heroName ?? t.inventoryEquippedByUnknown });
      }
      return sub(item.inStash ? t.forgeInStash : t.forgeInBag, { power });
    },
    gold,
    count: (value) => formatCount(value, locale),
    rolls: (value) => decimals(value, 1, locale),
    multiplier,
    chance,
    gain: (fraction) => formatGainPct(fraction * 100, locale),
    buysTip: (item, delta) => {
      const next = item.upgrade + 1;
      return sub(t.forgeBuysTip, {
        delta: formatGainPct(delta * 100, locale),
        cost: gold(forgeRollCost(item.level, item.rarityIdx, next)),
        target: forgeLevel(next),
        chance: chance(forgeChance(next)),
      });
    },
    minForge: (min) => forgeMinForgeText(min, t),
    span: (target) =>
      target <= FORGE_SAFE ? t.forgeSpanSafe : sub(t.forgeSpanRisky, { chance: chance(forgeChance(target)) }),
    warning: (target, safeJumps) =>
      target >= FORGE_MAX
        ? sub(t.forgeWarnMax, {
            max: forgeLevel(FORGE_MAX),
            floor: forgeLevel(0),
            times: safeJumps === null ? BLANK : decimals(safeJumps, 1, locale),
          })
        : sub(t.forgeWarnRisky, {
            from: forgeLevel(FORGE_SAFE + 1),
            to: forgeLevel(FORGE_MAX - 1),
            floor: forgeLevel(FORGE_SAFE),
          }),
    statsNote: (nowUpgrade, targetUpgrade) =>
      sub(t.forgeStatsNote, {
        factor: multiplier(targetUpgrade),
        target: forgeLevel(targetUpgrade),
        now: multiplier(nowUpgrade),
      }),
  };
}
