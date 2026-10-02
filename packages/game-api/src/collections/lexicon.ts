/**
 * The Collections wire lexicon: the body the client receives from `/colecao`, which carries the
 * whole catalog of set books and the account's progress in them. The keys are Portuguese (`tetos`,
 * `por_pagina`, `alavanca`) beside a few English ones (`sets`, `def_id`, `mask`), and this table is
 * the one place that vocabulary is translated into this codebase's own English domain field names.
 * `identify.ts` and `parse.ts` reference a wire token only through {@link wireKey}, never as an
 * inline literal.
 *
 * Percentages on the wire are in percent (13.65 means +13.65%).
 */

import type { CollectionAxis } from '@bombfarm/contracts';
import { createWireKeyLookup, type WireLexiconEntry } from '../wire-lexicon.js';

export type CollectionsWireSymbol =
  | 'version'
  | 'enabled'
  | 'partialPct'
  | 'upgrades'
  | 'caps'
  | 'totals'
  | 'raw'
  | 'sets'
  | 'pieces'
  | 'setCode'
  | 'setLevel'
  | 'setPagesDone'
  | 'setOnPage'
  | 'setPerPage'
  | 'setEffects'
  | 'effectAxis'
  | 'effectPages'
  | 'effectNow'
  | 'pieceDefId'
  | 'pieceSet'
  | 'pieceSlot'
  | 'pieceLevel'
  | 'pieceMask'
  | 'piecePending'
  | 'axisDamage'
  | 'axisCritDamage'
  | 'axisCritChance'
  | 'axisCooldown'
  | 'axisCage'
  | 'axisEnergy'
  | 'axisGold'
  | 'axisXp'
  | 'axisLuck'
  | 'axisForge';

const KEY_ENTRIES: ReadonlyArray<WireLexiconEntry & { readonly symbol: CollectionsWireSymbol }> = [
  { symbol: 'version', wireToken: 'versao', kind: 'key', domainField: 'version', description: "The body's version number (4 in the committed body). Not read.", origin: 'portuguese' },
  { symbol: 'enabled', wireToken: 'ligada', kind: 'key', domainField: 'enabled', description: 'Whether Collections is open to the account. Not read.', origin: 'portuguese' },
  { symbol: 'partialPct', wireToken: 'parcial_pct', kind: 'key', domainField: 'partialPct', description: "The share of a page's increment each piece pays before the page is complete, in percent (60 in the committed body).", origin: 'portuguese' },
  { symbol: 'upgrades', wireToken: 'upgrades', kind: 'key', domainField: 'upgrades', description: 'Six numbers, one per rarity. Meaning not established. Not read.', origin: 'english' },
  { symbol: 'caps', wireToken: 'tetos', kind: 'key', domainField: 'caps', description: 'The cap of each axis, one number per axis.', origin: 'portuguese' },
  { symbol: 'totals', wireToken: 'totais', kind: 'key', domainField: 'totals', description: 'What the account actually gets on each axis: the raw sum held to its cap.', origin: 'portuguese' },
  { symbol: 'raw', wireToken: 'brutos', kind: 'key', domainField: 'raw', description: "The uncapped sum of every set's current bonus, per axis.", origin: 'portuguese' },
  { symbol: 'sets', wireToken: 'sets', kind: 'key', domainField: 'sets', description: 'One entry per set book, with its effects and its progress.', origin: 'english' },
  { symbol: 'pieces', wireToken: 'pecas', kind: 'key', domainField: 'pieces', description: 'Every piece of every set, eight per set.', origin: 'portuguese' },
  { symbol: 'setCode', wireToken: 'set', kind: 'key', domainField: 'code', description: "The set's code.", origin: 'english' },
  { symbol: 'setLevel', wireToken: 'nivel', kind: 'key', domainField: 'level', description: 'The item level of the set.', origin: 'portuguese' },
  { symbol: 'setPagesDone', wireToken: 'paginas', kind: 'key', domainField: 'pagesComplete', description: 'The count of leading complete pages. Recomputable from `por_pagina`; not read.', origin: 'portuguese' },
  { symbol: 'setOnPage', wireToken: 'na_pagina', kind: 'key', domainField: 'piecesOnOpenPage', description: 'Pieces on the first incomplete page. Recomputable from `por_pagina`; not read.', origin: 'portuguese' },
  { symbol: 'setPerPage', wireToken: 'por_pagina', kind: 'key', domainField: 'piecesByPage', description: 'Pieces sacrificed on the page of each rarity, common first: six entries, 0 to 8. Pages need not fill in order.', origin: 'portuguese' },
  { symbol: 'setEffects', wireToken: 'efeitos', kind: 'key', domainField: 'effects', description: "The bonuses the set's book grants: one for most sets, three for the highest.", origin: 'portuguese' },
  { symbol: 'effectAxis', wireToken: 'alavanca', kind: 'key', domainField: 'axis', description: 'The axis an effect adds to, by its wire axis key.', origin: 'portuguese' },
  { symbol: 'effectPages', wireToken: 'paginas', kind: 'key', domainField: 'pageValues', description: 'Six cumulative bonuses: entry r is the bonus with the pages of rarity 0 through r complete.', origin: 'portuguese' },
  { symbol: 'effectNow', wireToken: 'agora', kind: 'key', domainField: 'now', description: 'What the effect grants at the current progress.', origin: 'portuguese' },
  { symbol: 'pieceDefId', wireToken: 'def_id', kind: 'key', domainField: 'defId', description: "The piece's item definition id.", origin: 'english' },
  { symbol: 'pieceSet', wireToken: 'set', kind: 'key', domainField: 'set', description: 'The code of the set the piece belongs to.', origin: 'english' },
  { symbol: 'pieceSlot', wireToken: 'slot', kind: 'key', domainField: 'slot', description: 'The equipment slot, 0 to 7: weapon, helmet, chestplate, leggings, boots, gloves, ring, amulet.', origin: 'english' },
  { symbol: 'pieceLevel', wireToken: 'level', kind: 'key', domainField: 'level', description: "The piece's item level.", origin: 'english' },
  { symbol: 'pieceMask', wireToken: 'mask', kind: 'key', domainField: 'sacrificedMask', description: 'Bit r set means the piece is sacrificed on the page of rarity r.', origin: 'english' },
  { symbol: 'piecePending', wireToken: 'pendente', kind: 'key', domainField: 'pendingMask', description: 'The same bits as `mask`, for a sacrifice still arriving from outside the bag.', origin: 'portuguese' },
  { symbol: 'axisDamage', wireToken: 'dano', kind: 'key', domainField: 'damage', description: 'The Damage axis.', origin: 'portuguese' },
  { symbol: 'axisCritDamage', wireToken: 'critd', kind: 'key', domainField: 'critDamage', description: 'The Critical damage axis.', origin: 'portuguese' },
  { symbol: 'axisCritChance', wireToken: 'critc', kind: 'key', domainField: 'critChance', description: 'The Critical chance axis.', origin: 'portuguese' },
  { symbol: 'axisCooldown', wireToken: 'recarga', kind: 'key', domainField: 'cooldown', description: 'The Cooldown axis.', origin: 'portuguese' },
  { symbol: 'axisCage', wireToken: 'jaula', kind: 'key', domainField: 'cage', description: 'The Cage and boss axis.', origin: 'portuguese' },
  { symbol: 'axisEnergy', wireToken: 'energia', kind: 'key', domainField: 'energy', description: 'The Energy axis.', origin: 'portuguese' },
  { symbol: 'axisGold', wireToken: 'ouro', kind: 'key', domainField: 'gold', description: 'The Gold axis.', origin: 'portuguese' },
  { symbol: 'axisXp', wireToken: 'xp', kind: 'key', domainField: 'xp', description: 'The Experience axis.', origin: 'english' },
  { symbol: 'axisLuck', wireToken: 'sorte', kind: 'key', domainField: 'luck', description: 'The Luck axis.', origin: 'portuguese' },
  { symbol: 'axisForge', wireToken: 'forja', kind: 'key', domainField: 'forge', description: 'The Forge axis.', origin: 'portuguese' },
];

export const COLLECTIONS_WIRE_LEXICON: readonly WireLexiconEntry[] = KEY_ENTRIES;

export const wireKey: (symbol: CollectionsWireSymbol) => string = createWireKeyLookup(KEY_ENTRIES, 'collections lexicon');

export const COLLECTION_AXIS_SYMBOLS: Readonly<Record<CollectionAxis, CollectionsWireSymbol>> = {
  damage: 'axisDamage',
  critDamage: 'axisCritDamage',
  critChance: 'axisCritChance',
  cooldown: 'axisCooldown',
  cage: 'axisCage',
  energy: 'axisEnergy',
  gold: 'axisGold',
  xp: 'axisXp',
  luck: 'axisLuck',
  forge: 'axisForge',
};

export const COLLECTIONS_TOP_LEVEL_SYMBOLS: readonly CollectionsWireSymbol[] = [
  'version',
  'enabled',
  'partialPct',
  'upgrades',
  'caps',
  'totals',
  'raw',
  'sets',
  'pieces',
];

export const COLLECTIONS_SET_SYMBOLS: readonly CollectionsWireSymbol[] = [
  'setCode',
  'setLevel',
  'setPagesDone',
  'setOnPage',
  'setPerPage',
  'setEffects',
];

export const COLLECTIONS_EFFECT_SYMBOLS: readonly CollectionsWireSymbol[] = ['effectAxis', 'effectPages', 'effectNow'];

export const COLLECTIONS_PIECE_SYMBOLS: readonly CollectionsWireSymbol[] = [
  'pieceDefId',
  'pieceSet',
  'pieceSlot',
  'pieceLevel',
  'pieceMask',
  'piecePending',
];
