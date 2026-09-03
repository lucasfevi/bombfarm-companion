/**
 * `AccountView` → the values the Account screen's four sections draw, each gated on the account
 * sections it actually reads. Pure, no React import.
 *
 * The farm board withholds everything unless all five sections are usable, because every figure it
 * prints is derived from all five. This screen is the opposite shape: four independent readings of
 * four different parts of the account, and an inventory that could not be read has nothing to say
 * about the skill tree. So each part carries its own gate and its own `null`, and a part whose
 * sections were not usable is absent rather than defaulted — there is no zero here standing in
 * for a value nobody read.
 */
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import { buildInventoryView } from '@bombfarm/domain/inventory-view';
import { resolveHouseRestSeconds } from '@bombfarm/domain/model';
import { ACCOUNT_SECTIONS } from '@bombfarm/domain/account-fidelity';
import { isTrustworthySection } from '@bombfarm/contracts';
import type {
  AccountPayload,
  AccountSection,
  AccountView,
  SectionFidelity,
} from '@bombfarm/contracts';
import type { PriceableHero, PriceableItem } from '@bombfarm/pricing';

/**
 * The withhold gate is per-section usability, never the account-wide fidelity grade. A
 * `degraded` section is usable only when `isTrustworthySection` says its body lost nothing.
 */
export function isSectionUsable(fidelity: SectionFidelity): boolean {
  if (fidelity.status === 'degraded') return isTrustworthySection(fidelity);
  return fidelity.status === 'resolved' || fidelity.status === 'stale';
}

export function sectionFidelityOf(
  payload: AccountPayload,
  section: AccountSection,
): SectionFidelity {
  // No fidelity block for a section reads as `missing` — the conservative, withhold-safe default.
  // It differs from `deriveAccountFidelity`'s own "absent fidelity ⇒ grade full" rule, which
  // exists for the web's direct-file import where every section is present by construction; an
  // `AccountView` always carries a real fidelity block, so this branch is defensive only.
  return payload.fidelity?.[section] ?? { status: 'missing' };
}

export function capturedAtOf(payload: AccountPayload, section: AccountSection): string | null {
  const fidelity = sectionFidelityOf(payload, section);
  return fidelity.status === 'missing' ? null : fidelity.capturedAt;
}

export interface AccountIdentityFacts {
  playerName: string | null;
  accountId: string | null;
  phase: number | null;
  maxPhase: number | null;
}

export interface AccountHouseFacts {
  houseIndex: number;
  houseLevel: number;
  slots: number;
  restSeconds: number;
}

export interface AccountTreeFacts {
  squadDamagePct: number;
  geoMultiplier: number;
  totalDamage: number;
  critChancePct: number;
  critDamagePct: number;
  speedPct: number;
  energyPct: number;
  teamCoinPct: number;
  luckFlatPct: number;
  xpMultiplier: number;
  fieldSlotsBonus: number;
  bagTabsBonus: number;
  fieldSlots: number | null;
}

/** A hero the market can price, carrying what the holdings list needs to depict it. */
export interface HoldingsHero extends PriceableHero {
  name: string;
  rank?: string | undefined;
  stars?: number | undefined;
  level?: number | undefined;
  skin?: number | undefined;
}

/** The three priceable readings behind the holdings section. `null` is "not read", never "none". */
export interface AccountHoldingsFacts {
  inventory: PriceableItem[] | null;
  heroes: HoldingsHero[] | null;
  skinsWorn: number[] | null;
}

export interface AccountFacts {
  identity: AccountIdentityFacts | null;
  house: AccountHouseFacts | null;
  tree: AccountTreeFacts | null;
  holdings: AccountHoldingsFacts;
  /** The oldest capture behind anything on the screen, so the age line never reads fresher than
   *  the stalest section it covers. `null` when no section carries a capture at all. */
  readCapturedAt: string | null;
}

type AccountBlock = ReturnType<typeof parseAccountPayload>['account'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readable(payload: AccountPayload, section: AccountSection): boolean {
  return isSectionUsable(sectionFidelityOf(payload, section));
}

/**
 * The account-wide parse, over the sections that may be read and with the roster dropped.
 *
 * **Taking an unreadable section out of the input IS the House's and the skill tree's withhold
 * gate**, and the only one. An absent house and absent totals are exactly what the parser reports
 * as no house and no tree, which the two readers below already have to handle; a second
 * `readable(…)` check inside each of them would be a branch that could be deleted with every test
 * still green, which is worse than no branch at all.
 *
 * `account` is deliberately NOT filtered here — identity is withheld by its own reader instead,
 * because a filtered-out account block is a panel of four blanks rather than no panel. `skills` is
 * filtered for a second reason besides the tree: `max_phase` is read off the account block and
 * falls back to the skill tree's own copy, and a skill section that may not be read must not
 * supply it.
 *
 * The roster is dropped rather than filtered, because `parseAccountPayload` rejects the WHOLE
 * payload when a hero lacks birth stats or the list is not an array, and a reject empties the
 * account block it returns. Nothing the three panels show is read off a hero, so a roster problem
 * must not be able to take the House and the skill tree down with it.
 */
function accountBlockOf(payload: AccountPayload): AccountBlock {
  return parseAccountPayload(
    {
      account: payload.account,
      skills: readable(payload, 'skills') ? payload.skills : undefined,
      casa: readable(payload, 'casa') ? payload.casa : undefined,
      heroes: [],
      fidelity: payload.fidelity,
    },
    [],
  ).account;
}

function identityFactsOf(payload: AccountPayload, account: AccountBlock): AccountIdentityFacts | null {
  if (!readable(payload, 'account')) return null;
  return {
    playerName: account.playerName ?? null,
    accountId: account.accountId ?? null,
    phase: account.phase,
    maxPhase: account.maxPhase ?? null,
  };
}

function houseFactsOf(account: AccountBlock): AccountHouseFacts | null {
  const { houseIdx, houseLevel, slots } = account;
  if (houseIdx === null || houseLevel === null || slots == null) return null;
  return {
    houseIndex: houseIdx,
    houseLevel,
    slots,
    restSeconds: resolveHouseRestSeconds(account.houseCycleSecs, houseIdx, houseLevel),
  };
}

function treeFactsOf(account: AccountBlock): AccountTreeFacts | null {
  const tree = account.tree;
  if (tree === null) return null;

  const { squadDmgPct, geoMult, teamCoinPct, xpMult, fieldSlotsBonus, bagTabsBonus } = tree;
  if (
    squadDmgPct === undefined ||
    geoMult === undefined ||
    teamCoinPct === undefined ||
    xpMult === undefined ||
    fieldSlotsBonus === undefined ||
    bagTabsBonus === undefined
  ) {
    return null;
  }

  return {
    squadDamagePct: squadDmgPct,
    geoMultiplier: geoMult,
    totalDamage: tree.danoTotal,
    critChancePct: tree.critChance,
    critDamagePct: tree.critDmg,
    speedPct: tree.speed,
    energyPct: tree.energy,
    teamCoinPct,
    luckFlatPct: tree.luckFlatPct,
    xpMultiplier: xpMult,
    fieldSlotsBonus,
    bagTabsBonus,
    fieldSlots: account.fieldSlots ?? null,
  };
}

const priceableItem = (item: {
  defId: string;
  rarityIdx: number;
  tradable: boolean;
}): PriceableItem => ({ defId: item.defId, rarity: item.rarityIdx, tradable: item.tradable });

const UNNAMED_HERO = '—';

function heroNameOf(raw: Record<string, unknown>): string {
  const name = raw.name;
  return typeof name === 'string' && name.trim() !== '' ? name : UNNAMED_HERO;
}

function roundedNumberOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : undefined;
}

/**
 * The desktop reads the roster the game itself serves, and those records carry `marketable` — the
 * game's own answer to whether a hero may be listed at all. A row that does not carry the flag is
 * treated as unsellable, which keeps it out of the total AND out of the count the coverage is
 * over, rather than inventing a price for it.
 */
function priceableHeroesOf(rawHeroes: readonly unknown[]): HoldingsHero[] {
  const heroes: HoldingsHero[] = [];
  for (const raw of rawHeroes) {
    if (!isObject(raw)) continue;
    const rarity = raw.rarity;
    if (typeof rarity !== 'number' || !Number.isFinite(rarity)) continue;
    heroes.push({
      name: heroNameOf(raw),
      rarity: Math.round(rarity),
      marketable: raw.marketable === true,
      rank: typeof raw.rank === 'string' ? raw.rank : undefined,
      stars: roundedNumberOf(raw.stars),
      level: roundedNumberOf(raw.level),
      skin: roundedNumberOf(raw.skin),
    });
  }
  return heroes;
}

function skinsWornOf(rawHeroes: readonly unknown[]): number[] {
  const skins: number[] = [];
  for (const raw of rawHeroes) {
    if (!isObject(raw)) continue;
    const skin = raw.skin;
    if (typeof skin !== 'number' || !Number.isFinite(skin)) continue;
    skins.push(Math.round(skin));
  }
  return skins;
}

function holdingsFactsOf(payload: AccountPayload): AccountHoldingsFacts {
  const rawItems = payload.items;
  const rawHeroes = payload.heroes;
  const inventoryRead = readable(payload, 'items') && Array.isArray(rawItems);
  const rosterRead = readable(payload, 'heroes') && Array.isArray(rawHeroes);

  return {
    // The same derivation the Inventory screen draws from, so the two cannot disagree about what
    // the inventory holds.
    inventory: inventoryRead ? buildInventoryView(rawItems).items.map(priceableItem) : null,
    heroes: rosterRead ? priceableHeroesOf(rawHeroes) : null,
    skinsWorn: rosterRead ? skinsWornOf(rawHeroes) : null,
  };
}

/**
 * The OLDEST capture time across the five sections, so a line drawn from it never claims to be
 * fresher than the stalest thing under it. Exported because the farm board dates its numbers by
 * this too: both screens must answer "how old is this account read?" the same way, and the farm
 * board asking a clock of its own is what let it report a fresh calculation over a frozen account.
 */
export function oldestCaptureOf(payload: AccountPayload): string | null {
  let oldest: string | null = null;
  let oldestMs = Number.POSITIVE_INFINITY;
  for (const section of ACCOUNT_SECTIONS) {
    const capturedAt = capturedAtOf(payload, section);
    if (capturedAt === null) continue;
    const capturedMs = Date.parse(capturedAt);
    if (!Number.isFinite(capturedMs) || capturedMs >= oldestMs) continue;
    oldest = capturedAt;
    oldestMs = capturedMs;
  }
  return oldest;
}

export function accountFactsFrom(view: AccountView): AccountFacts {
  const payload = view.payload;
  const account = accountBlockOf(payload);
  return {
    identity: identityFactsOf(payload, account),
    house: houseFactsOf(account),
    tree: treeFactsOf(account),
    holdings: holdingsFactsOf(payload),
    readCapturedAt: oldestCaptureOf(payload),
  };
}
