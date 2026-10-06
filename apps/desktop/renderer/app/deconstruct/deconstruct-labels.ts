import {
  BCP47_BY_LOCALE,
  type AccountSource,
  type AppLocale,
  type DeconstructStartReason,
  type DomainLang,
} from '@bombfarm/contracts';
import {
  deconstructRefusalReason,
  DECONSTRUCT_BATCH_MAX,
  DECONSTRUCT_WARN_RARITY,
  type DeconstructBlockReason,
  type DeconstructBatchSummary,
} from '@bombfarm/domain/deconstruct';
import { itemRarityLabel, slotLabel } from '@bombfarm/domain/game-labels';
import type { InventoryHero, InventoryViewItem, ItemKind } from '@bombfarm/domain/inventory-view';
import type { InventoryTableColumnId, InventoryTableLabels, ItemIdentityLabels } from '@bombfarm/game-art';
import { sub, type Copy } from '../../lib/copy';
import { formatCount } from '../../lib/format';
import type { DeconstructLocation } from '../../lib/deconstruct/deconstruct-rows';
import type { DeconstructOutcome } from '../../lib/deconstruct/deconstruct-run-reducer';
import { forgeStartRefusalText } from '../forge/forge-labels';
import { inventoryLabels, inventoryTableLabels } from '../inventory/inventory-labels';

export const BLANK = '—';

/** What the list shows: what the item is, how far it is forged, who wears it, and — as the host's
 *  own column — what burning it pays. No value, price or count: a row is one item and none of
 *  the three is what this page is deciding about. */
export const DECONSTRUCT_TABLE_COLUMNS: readonly InventoryTableColumnId[] = ['name', 'forge', 'hero'];

/** The same without who wears it, for a window too narrow to spare the column: the name would be
 *  left with a sliver, and a row that cannot be burned says why beside its checkbox anyway. */
export const DECONSTRUCT_NARROW_TABLE_COLUMNS: readonly InventoryTableColumnId[] = ['name', 'forge'];

/** The width under which the page gives up the equipped-by column and narrows its batch column. */
export const DECONSTRUCT_NARROW_QUERY = '(max-width: 1179px)';

export function deconstructBlockText(reason: DeconstructBlockReason, t: Copy): string {
  switch (reason) {
    case 'equipped':
      return t.deconstructBlockEquipped;
    case 'locked':
      return t.deconstructBlockLocked;
    case 'market':
      return t.deconstructBlockMarket;
    case 'has_gems':
      return t.deconstructBlockGems;
    case 'import_cooldown':
      return t.deconstructBlockCooldown;
    case 'not_burnable':
      return t.deconstructBlockNotBurnable;
  }
}

/** The server's refusal of a whole batch, in the game's words — or a line that prints the code
 *  when the client has no wording for it. */
export function deconstructRefusalText(code: string, t: Copy): string {
  const reason = deconstructRefusalReason(code);
  if (reason === null) return sub(t.deconstructRefusedUnknown, { code });
  if (reason === 'batch_too_big') return sub(t.deconstructBatchTooBig, { max: DECONSTRUCT_BATCH_MAX });
  if (reason === 'missing_item') return t.deconstructMissingItem;
  return deconstructBlockText(reason, t);
}

export type DeconstructButtonReason = 'running' | 'forge' | 'fixture' | 'switch-off' | 'none' | 'ready';

/**
 * What the Burn button is for right now, first reason that applies. A burn in flight owns the
 * button; a forge run or queue holds the one writer lock, so there is nothing to burn with; an
 * account with no server behind it beats the switch, because turning the switch on would not
 * help; and an empty batch is the last thing between the player and the confirm.
 */
export function deconstructButtonReason(input: {
  accountSource: AccountSource | null;
  forgeWritesEnabled: boolean;
  burning: boolean;
  forgeBusy: boolean;
  selected: number;
}): DeconstructButtonReason {
  if (input.burning) return 'running';
  if (input.forgeBusy) return 'forge';
  if (input.accountSource === 'fixture') return 'fixture';
  if (!input.forgeWritesEnabled) return 'switch-off';
  if (input.selected === 0) return 'none';
  return 'ready';
}

export function deconstructReasonText(reason: DeconstructButtonReason, t: Copy): string {
  switch (reason) {
    case 'running':
      return t.deconstructReasonRunning;
    case 'forge':
      return t.deconstructReasonForge;
    case 'fixture':
      return t.deconstructReasonFixture;
    case 'switch-off':
      return sub(t.deconstructReasonSwitchOff, { switch: t.settingsForgeWritesLabel });
    case 'none':
      return t.deconstructReasonNone;
    case 'ready':
      return t.deconstructReasonReady;
  }
}

/** Main's refusal to start, in the player's terms. Where the forge page already says the same
 *  thing in the same words, its line is reused. */
export function deconstructStartRefusalText(reason: DeconstructStartReason, t: Copy): string {
  switch (reason) {
    case 'busy':
      return forgeStartRefusalText('busy', t);
    case 'offline':
      return t.deconstructReasonFixture;
    case 'bad_request':
      return t.deconstructStartBadRequest;
    case 'not_consented':
      return t.deconstructStartNotConsented;
    case 'game_not_running':
      return t.deconstructStartGameNotRunning;
    case 'token_unavailable':
      return forgeStartRefusalText('token_unavailable', t);
    case 'writes_disabled':
      return sub(t.deconstructReasonSwitchOff, { switch: t.settingsForgeWritesLabel });
    case 'unknown_item':
      return t.deconstructStartUnknownItem;
    case 'unavailable':
      return forgeStartRefusalText('unavailable', t);
  }
}

export type DeconstructHint =
  | { readonly kind: 'cap' }
  | { readonly kind: 'overflow'; readonly count: number }
  | { readonly kind: 'pruned'; readonly count: number }
  | { readonly kind: 'fill-none' };

/** The line under the batch figures: what the last press could not do, and why. */
export function deconstructHintText(hint: DeconstructHint, t: Copy, labels: DeconstructLabels): string {
  switch (hint.kind) {
    case 'cap':
      return sub(t.deconstructBatchTooBig, { max: DECONSTRUCT_BATCH_MAX });
    case 'overflow':
      return sub(t.deconstructHintOverflow, { count: labels.count(hint.count), max: DECONSTRUCT_BATCH_MAX });
    case 'pruned':
      return hint.count === 1
        ? t.deconstructHintPrunedOne
        : sub(t.deconstructHintPrunedMany, { count: labels.count(hint.count) });
    case 'fill-none':
      return t.deconstructHintFillNone;
  }
}

export type DeconstructAddAllBlock = 'nothing-burnable' | 'all-added';

/** Why the list's add-all button has nothing to do, or `null` while it has. */
export function deconstructAddAllBlock(counts: { burnable: number; addable: number }): DeconstructAddAllBlock | null {
  if (counts.burnable === 0) return 'nothing-burnable';
  return counts.addable === 0 ? 'all-added' : null;
}

export function deconstructAddAllBlockText(block: DeconstructAddAllBlock, t: Copy): string {
  return block === 'nothing-burnable' ? t.deconstructAddAllNothing : t.deconstructAddAllDone;
}

export type DeconstructResultTone = 'ok' | 'warn';

export type DeconstructResultView = {
  readonly tone: DeconstructResultTone;
  readonly heading: string;
  readonly lines: readonly string[];
};

function failedLine(reason: Extract<DeconstructOutcome, { kind: 'failed' }>['reason'], t: Copy): string {
  switch (reason) {
    case 'cooldown':
      return t.deconstructFailedCooldown;
    case 'session':
      return t.deconstructFailedSession;
    case 'network':
      return t.deconstructFailedNetwork;
    case 'unreadable':
      return t.deconstructFailedUnreadable;
    case 'error':
      return t.deconstructFailedError;
  }
}

/** The band's words for a settled burn. The figures come from the server's answer as it was
 *  sent: the gain is what it paid, and the balance is what it says is left. */
export function deconstructResultView(outcome: DeconstructOutcome, t: Copy, labels: DeconstructLabels): DeconstructResultView {
  switch (outcome.kind) {
    case 'burned': {
      const essence = labels.signedCount(outcome.gained);
      const heading =
        outcome.burned === 1
          ? sub(t.deconstructResultBurnedOne, { essence })
          : sub(t.deconstructResultBurnedMany, { count: labels.count(outcome.burned), essence });
      return { tone: 'ok', heading, lines: [sub(t.deconstructResultBalance, { essence: labels.count(outcome.essence) })] };
    }
    case 'refused':
      return { tone: 'warn', heading: t.deconstructResultRefused, lines: [deconstructRefusalText(outcome.code, t)] };
    case 'failed':
      return {
        tone: 'warn',
        heading: t.deconstructResultFailed,
        lines: [failedLine(outcome.reason, t), t.deconstructFailedRefresh],
      };
    case 'start-refused':
      return { tone: 'warn', heading: t.deconstructResultFailed, lines: [deconstructStartRefusalText(outcome.reason, t)] };
  }
}

export interface DeconstructLabels extends ItemIdentityLabels<InventoryViewItem> {
  searchText: (item: InventoryViewItem) => string;
  slotName: (slot: string | null) => string;
  rarityName: (rarityIdx: number) => string;
  kindName: (kind: ItemKind) => string;
  locationName: (location: DeconstructLocation) => string;
  setOption: ReturnType<typeof inventoryLabels>['setOption'];
  setOptionCount: ReturnType<typeof inventoryLabels>['setOptionCount'];
  /** What a batch row says of a group: "Epic Keys", "Item chest · Lv 80". */
  groupName: (item: InventoryViewItem) => string;
  count: (value: number) => string;
  /** `+1,234` — the sign is data, not copy, so no sentence has to carry a plus. */
  signedCount: (value: number) => string;
  /** The rarity the second confirm line names, from the domain's own threshold. */
  warnRarity: string;
}

export function deconstructLabels(t: Copy, lang: DomainLang, locale: AppLocale): DeconstructLabels {
  const inventory = inventoryLabels(t, lang);
  const count = (value: number) => formatCount(value, locale);
  const bcp47 = BCP47_BY_LOCALE[locale];

  return {
    lang,
    itemName: inventory.itemName,
    itemRarity: inventory.itemRarity,
    itemLevel: inventory.itemLevel,
    itemForge: inventory.itemForge,
    searchText: inventory.searchText,
    slotName: (slot) => (slot === null ? BLANK : slotLabel(slot, lang)),
    rarityName: (rarityIdx) => itemRarityLabel(rarityIdx, lang),
    kindName: inventory.groupTitle,
    locationName: (location) => {
      switch (location) {
        case 'any':
          return t.deconstructLocationAny;
        case 'bag':
          return t.deconstructLocationBag;
        case 'stash':
          return t.deconstructLocationStash;
      }
    },
    setOption: inventory.setOption,
    setOptionCount: inventory.setOptionCount,
    groupName: (item) =>
      item.kind === 'chest'
        ? inventory.itemName(item)
        : sub(t.deconstructGroupLabel, { rarity: itemRarityLabel(item.rarityIdx, lang), kind: inventory.groupTitle(item.kind) }),
    count,
    signedCount: (value) => `+${Math.round(value).toLocaleString(bcp47)}`,
    warnRarity: itemRarityLabel(DECONSTRUCT_WARN_RARITY, lang),
  };
}

/** The essence column as the host draws it: the server's figure per item, or a dash when the row
 *  carried none. */
export function essenceCell(item: InventoryViewItem, labels: Pick<DeconstructLabels, 'count'>): string {
  return item.essenceValue === null ? BLANK : labels.count(item.essenceValue);
}

/** The lines the confirm prints, with the counts that make each apply. */
export function deconstructWarnings(summary: DeconstructBatchSummary, t: Copy, labels: DeconstructLabels): {
  forged: { active: boolean; text: string };
  rare: { active: boolean; text: string };
} {
  return {
    forged: { active: summary.forged > 0, text: sub(t.deconstructWarnForged, { count: summary.forged }) },
    rare: { active: summary.rare > 0, text: sub(t.deconstructWarnRare, { rarity: labels.warnRarity, count: summary.rare }) },
  };
}

/**
 * The list's labels, which are the Inventory table's with the words a checklist needs. Derived
 * rather than written out: both tables list the same items out of the same account, and a second
 * bag of item names is how the two screens would start naming the same sword differently.
 */
export function deconstructTableLabels(t: Copy, lang: DomainLang, heroes: ReadonlyMap<string, InventoryHero>): InventoryTableLabels {
  return {
    ...inventoryTableLabels(t, lang, heroes),
    caption: t.deconstructTableCaption,
    rowAction: (itemName) => sub(t.deconstructRowSelect, { item: itemName }),
    selectRow: (itemName) => sub(t.deconstructRowSelect, { item: itemName }),
    selectColumn: t.deconstructColumnSelect,
    empty: { title: t.deconstructEmptyTitle, description: t.deconstructEmptyDescription },
  };
}
