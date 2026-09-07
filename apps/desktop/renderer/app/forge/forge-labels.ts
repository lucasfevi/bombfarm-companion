import {
  BCP47_BY_LOCALE,
  type AccountSource,
  type AppLocale,
  type DomainLang,
  type ForgeRunResult,
  type ForgeStartReason,
  type ForgeStopReason,
} from '@bombfarm/contracts';
import { FORGE_MAX, FORGE_SAFE, forgeChance } from '@bombfarm/domain/forge';
import { upgradeMult } from '@bombfarm/domain/gear';
import { itemRarityLabel, itemStatLabel, slotLabel } from '@bombfarm/domain/game-labels';
import type { ItemIdentityLabels } from '@bombfarm/game-art';
import type { InventoryViewItem, InventoryViewStat } from '@bombfarm/domain/inventory-view';
import { sub, type Copy } from '../../lib/copy';
import { formatCount } from '../../lib/format';
import { FORGE_BAND_RANGE, type ForgeBand } from '../../lib/forge/forge-rows';
import { inventoryLabels } from '../inventory/inventory-labels';

export const BLANK = '—';

/** A forge level as the game prints it. */
export function forgeLevel(upgrade: number): string {
  return `+${String(upgrade)}`;
}

export type ForgeButtonReason = 'maxed' | 'fixture' | 'switch-off' | 'ready' | 'running' | 'cancelling';

/**
 * What the Forge button is for right now, first reason that applies. A run in flight owns the
 * button outright — it is the cancel, until the cancel has been asked for and the button has
 * nothing left to do but say so. Otherwise a piece with nowhere to go beats everything; an
 * account with no server behind it beats the switch, because turning the switch on would not
 * help; and only then is the button armed.
 */
export function forgeButtonReason(input: {
  upgrade: number;
  accountSource: AccountSource | null;
  forgeWritesEnabled: boolean;
  running: boolean;
  cancelRequested: boolean;
}): ForgeButtonReason {
  if (input.running) return input.cancelRequested ? 'cancelling' : 'running';
  if (input.upgrade >= FORGE_MAX) return 'maxed';
  if (input.accountSource === 'fixture') return 'fixture';
  if (!input.forgeWritesEnabled) return 'switch-off';
  return 'ready';
}

export function forgeReasonText(reason: ForgeButtonReason, t: Copy): string {
  switch (reason) {
    case 'maxed':
      return sub(t.forgeReasonMaxed, { max: forgeLevel(FORGE_MAX) });
    case 'fixture':
      return t.forgeReasonFixture;
    case 'switch-off':
      return sub(t.forgeReasonSwitchOff, { switch: t.settingsForgeWritesLabel });
    case 'ready':
      return t.forgeReasonReady;
    case 'running':
      return t.forgeReasonRunning;
    case 'cancelling':
      return t.forgeReasonCancelling;
  }
}

/** Main's refusal, in the player's terms. The fixture and the switch say what the reason line
 *  already says for them; the rest are things only main can know. */
export function forgeStartRefusalText(reason: ForgeStartReason, t: Copy): string {
  switch (reason) {
    case 'busy':
      return t.forgeStartBusy;
    case 'offline':
      return t.forgeReasonFixture;
    case 'not_consented':
      return t.forgeStartNotConsented;
    case 'game_not_running':
      return t.forgeStartGameNotRunning;
    case 'token_unavailable':
      return t.forgeStartTokenUnavailable;
    case 'writes_disabled':
      return sub(t.forgeReasonSwitchOff, { switch: t.settingsForgeWritesLabel });
    case 'unknown_item':
      return t.forgeStartUnknownItem;
    case 'bad_target':
      return t.forgeStartBadTarget;
    case 'unavailable':
      return t.forgeStartUnavailable;
  }
}

export type ForgeResultTone = 'up' | 'warn' | 'down';

/** The result heading in the player's terms, and the tone it is tinted with: reaching the target
 *  is a gain, the player's own limits are a warning, and the server's refusals are a loss. */
export function forgeResultHeading(result: ForgeRunResult, t: Copy): { text: string; tone: ForgeResultTone } {
  const level = forgeLevel(result.to);
  switch (result.stop) {
    case 'target':
      return { text: sub(t.forgeResultReached, { level }), tone: 'up' };
    case 'cancelled':
      return { text: sub(t.forgeResultCancelled, { level, rolls: result.rolls }), tone: 'warn' };
    case 'shortfall':
      return { text: sub(t.forgeResultShortfall, { level }), tone: 'down' };
    case 'budget':
      return { text: sub(t.forgeResultBudget, { level }), tone: 'warn' };
    case 'attempts':
      return { text: sub(t.forgeResultAttempts, { level }), tone: 'warn' };
    case 'cooldown':
      return { text: sub(t.forgeResultCooldown, { level }), tone: 'down' };
    case 'missing':
      return { text: t.forgeResultMissing, tone: 'down' };
    case 'error':
      return { text: sub(t.forgeResultError, { level }), tone: 'down' };
  }
}

/**
 * How a run's spend stands against the plan it was made from. At or under the expected figure is
 * a gain; over it but inside the bad run is the range the plan said to prepare for; past the bad
 * run is worse than the plan ever offered.
 */
export function forgeSpendTone(spent: number, forecast: { gold: number; badRunGold: number }): ForgeResultTone {
  if (spent <= forecast.gold) return 'up';
  return spent <= forecast.badRunGold ? 'warn' : 'down';
}

/** Why a run ended, short enough for a ledger cell — the rung it stopped on is the row's own
 *  climb column, so this says only what stopped it. */
export function forgeStopText(stop: ForgeStopReason, t: Copy): string {
  switch (stop) {
    case 'target':
      return t.forgeStopTarget;
    case 'cancelled':
      return t.forgeStopCancelled;
    case 'shortfall':
      return t.forgeStopShortfall;
    case 'budget':
      return t.forgeStopBudget;
    case 'attempts':
      return t.forgeStopAttempts;
    case 'cooldown':
      return t.forgeStopCooldown;
    case 'missing':
      return t.forgeStopMissing;
    case 'error':
      return t.forgeStopError;
  }
}

/** `+9…+11` for a merged row, `+12` for one that stands alone. */
export function forgeRungLabel(row: { from: number; to: number }): string {
  return row.from === row.to ? forgeLevel(row.from) : `${forgeLevel(row.from)}…${forgeLevel(row.to)}`;
}

/** The forge filter is a stretch of the ladder, so a band names both of its ends — except the two
 *  that stand on a single rung and the one at the top, which has no end to name. */
export function forgeBandText(band: ForgeBand | null, t: Copy): string {
  if (band === null) return t.forgeBandAny;
  const { from, to } = FORGE_BAND_RANGE[band];
  if (to === null) return sub(t.forgeBandFrom, { level: forgeLevel(from) });
  if (to === from) return sub(t.forgeBandOnly, { level: forgeLevel(from) });
  return sub(t.forgeBandRange, { from: forgeLevel(from), to: forgeLevel(to) });
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

export interface ForgeLabels extends ItemIdentityLabels<InventoryViewItem> {
  searchText: (item: InventoryViewItem) => string;
  slotName: (slot: string | null) => string;
  rarityName: (rarityIdx: number) => string;
  gold: (amount: number) => string;
  count: (value: number) => string;
  rolls: (value: number) => string;
  multiplier: (upgrade: number) => string;
  /** A chance as the game prints it: `50%`. */
  chance: (fraction: number) => string;
  /** A difference as a signed whole percent: `+23%`, `−12%`. */
  signedPercent: (fraction: number) => string;
  band: (band: ForgeBand | null) => string;
  span: (target: number) => string;
  warning: (target: number, safeJumps: number | null) => string;
  statsNote: (nowUpgrade: number, targetUpgrade: number) => string;
}

export function forgeLabels(t: Copy, lang: DomainLang, locale: AppLocale): ForgeLabels {
  const inventory = inventoryLabels(t, lang);
  const bcp47 = BCP47_BY_LOCALE[locale];
  const chance = (fraction: number) =>
    new Intl.NumberFormat(bcp47, { style: 'percent', maximumFractionDigits: 0 }).format(fraction);
  const signedPercent = (fraction: number) =>
    new Intl.NumberFormat(bcp47, { style: 'percent', maximumFractionDigits: 0, signDisplay: 'always' })
      .format(fraction)
      .replace(/^-/, '−');
  const gold = (amount: number) => formatCount(amount, locale);
  const multiplier = (upgrade: number) => decimals(upgradeMult(upgrade), 2, locale);

  return {
    itemName: inventory.itemName,
    itemRarity: inventory.itemRarity,
    itemLevel: inventory.itemLevel,
    itemForge: inventory.itemForge,
    searchText: inventory.searchText,
    slotName: (slot) => (slot === null ? BLANK : slotLabel(slot, lang)),
    rarityName: (rarityIdx) => itemRarityLabel(rarityIdx, lang),
    gold,
    count: (value) => formatCount(value, locale),
    rolls: (value) => decimals(value, 1, locale),
    multiplier,
    chance,
    signedPercent,
    band: (band) => forgeBandText(band, t),
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
