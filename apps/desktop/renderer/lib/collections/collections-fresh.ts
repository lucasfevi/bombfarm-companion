/**
 * Whether the held Collections state has fallen behind the account the player is playing.
 *
 * The account read already carries the ten bonus totals, and it is re-read on its own clock, while
 * the Collections state is read only when the tab opens or is pressed. A player who sacrifices a
 * piece in the game with this tab open therefore sees the account move first. That is the cue to
 * ask for one more Collections read — once per distinct totals value, so a read the game refuses
 * cannot be asked for again on every account push.
 */
import { COLLECTION_AXES, type AccountPayload, type CollectionAxis, type CollectionAxisValues } from '@bombfarm/contracts';
import { collectionFromSave, collectionCents, type Collection } from '@bombfarm/domain/model';
import { isSectionUsable, sectionFidelityOf } from '../account/account-facts';

const FIELD_OF_AXIS: Readonly<Record<CollectionAxis, keyof Collection>> = {
  damage: 'damagePct',
  critDamage: 'critDmgPct',
  critChance: 'critChancePct',
  cooldown: 'cdrPct',
  cage: 'cagePct',
  energy: 'energyPct',
  gold: 'goldPct',
  xp: 'xpPct',
  luck: 'luckPct',
  forge: 'forgePct',
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The account read's ten totals by axis; `null` when the skills section is not usable or the read
 *  carries no Collections block at all (which says nothing, rather than saying zero). */
export function accountCollectionTotals(payload: AccountPayload): CollectionAxisValues | null {
  if (!isSectionUsable(sectionFidelityOf(payload, 'skills'))) return null;
  const totals = payload.skills?.totals;
  if (!isPlainObject(totals) || !isPlainObject(totals.colecao)) return null;
  const collection = collectionFromSave(totals);
  return Object.fromEntries(COLLECTION_AXES.map((axis) => [axis, collection[FIELD_OF_AXIS[axis]]])) as CollectionAxisValues;
}

/** The totals reduced to the hundredths the server states them in, so equal totals make equal keys. */
function collectionTotalsKey(totals: CollectionAxisValues): string {
  return COLLECTION_AXES.map((axis) => collectionCents(totals[axis])).join(',');
}

/** The key of the totals the read made on opening the tab answers for: asking again for the very
 *  totals already on screen when it opened would be the same read twice. */
export function collectionTotalsCovered(account: CollectionAxisValues | null): string | null {
  return account === null ? null : collectionTotalsKey(account);
}

export interface CollectionFreshnessInput {
  readonly account: CollectionAxisValues | null;
  readonly held: CollectionAxisValues | null;
  /** The key of the totals a read was last asked for. */
  readonly askedFor: string | null;
}

export type CollectionFreshnessDecision = { readonly ask: false } | { readonly ask: true; readonly key: string };

export function collectionFreshnessDecision({ account, held, askedFor }: CollectionFreshnessInput): CollectionFreshnessDecision {
  if (account === null || held === null) return { ask: false };
  const key = collectionTotalsKey(account);
  if (key === collectionTotalsKey(held) || key === askedFor) return { ask: false };
  return { ask: true, key };
}
