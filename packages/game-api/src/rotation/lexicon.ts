/**
 * The rotation wire lexicon. `/rotation`'s wire body mixes
 * Portuguese and English keys (`casa` beside `cycle_secs`, `energia_atual` beside `battle_allowed`)
 * — this table is the one place that vocabulary is translated into this codebase's own English
 * domain field names. `normalize.ts` and everything else under `rotation/` reference a wire token
 * only through {@link wireKey}/{@link stateSymbolForToken} below, never as an inline string
 * literal — {@link ROTATION_WIRE_LEXICON} is what `../wire-glossary.js` collects Portuguese tokens
 * from for `vocabulary-guard.ts`'s forbidden pattern, so a literal here would make the guard
 * unable to forbid itself out of its own scan surface.
 *
 * This only covers the rotation boundary this feature builds. It does not migrate the many
 * pre-existing Portuguese identifiers elsewhere in the tree (`packages/domain`'s `SchemaLevel`
 * key lists, `packages/contracts`'s `RawHeroEnergy`, and others) — that is separate, out-of-scope
 * work. The combat websocket's own wire vocabulary lives in `../live-frame/lexicon.ts`, built on
 * the same generic machinery from `../wire-lexicon.js`.
 */

import { createWireKeyLookup, type WireLexiconEntry, type WireVocabularyOrigin } from '../wire-lexicon.js';

export type { WireLexiconEntry, WireVocabularyKind, WireVocabularyOrigin } from '../wire-lexicon.js';

/** Every declared `/rotation` wire KEY — the union of `ROTATION_LEVEL`, `ROTATION_HERO_LEVEL` and
 *  `CASA_LEVEL` in `packages/game-api/src/fingerprints.ts` (itself importing `CASA_LEVEL` from
 *  `packages/domain/src/save-schema.ts`). Kept as a literal union so a typo in {@link wireKey}'s
 *  caller is a compile error, not a silent lookup miss. */
export type RotationWireSymbol =
  | 'fieldSize'
  | 'heroesList'
  | 'house'
  | 'rescuesLeft'
  | 'rescuesMax'
  | 'heroId'
  | 'heroLevel'
  | 'heroEnergy'
  | 'heroEnergyMax'
  | 'heroEnergyFraction'
  | 'heroState'
  | 'heroOnField'
  | 'heroInHouse'
  | 'heroRecovering'
  | 'heroBattleAllowed'
  | 'houseActive'
  | 'houseLevels'
  | 'houseCycleSeconds'
  | 'houseSlots'
  | 'houseSlotsPerHouse'
  | 'houseCycleSecondsPerHouse'
  | 'houseUpgradeCost';

/** The four `state` wire values: `DESCANSANDO`, `EM_CAMPO`, and `NO_BANCO` are present in the
 *  committed rotation fixture; `PRONTO` is documented from a live observation instead — it is
 *  produced by the House "Skip" action and does not appear in the fixture's captured moment. */
export type RotationStateSymbol = 'resting' | 'inField' | 'benched' | 'ready';

const KEY_ENTRIES: ReadonlyArray<{
  readonly symbol: RotationWireSymbol;
  readonly wireToken: string;
  readonly domainField: string;
  readonly description: string;
  readonly origin: WireVocabularyOrigin;
}> = [
  {
    symbol: 'fieldSize',
    wireToken: 'field_size',
    domainField: 'fieldSize',
    description: 'Number of field slots the account can deploy heroes into.',
    origin: 'english',
  },
  {
    symbol: 'heroesList',
    wireToken: 'heroes',
    domainField: 'heroes',
    description: 'Per-hero rotation state, one entry per roster hero.',
    origin: 'english',
  },
  {
    symbol: 'house',
    wireToken: 'casa',
    domainField: 'house',
    description: "The account's house / rotation-cycle object.",
    origin: 'portuguese',
  },
  {
    symbol: 'rescuesLeft',
    wireToken: 'rescues_left',
    domainField: 'rescuesLeft',
    description: 'Rescue charges remaining this cycle.',
    origin: 'english',
  },
  {
    symbol: 'rescuesMax',
    wireToken: 'rescues_max',
    domainField: 'rescuesMax',
    description: 'Maximum rescue charges the account can hold.',
    origin: 'english',
  },
  {
    symbol: 'heroId',
    wireToken: 'id',
    domainField: 'id',
    description: 'Hero id — joins against `/roster` for name and grade.',
    origin: 'english',
  },
  {
    symbol: 'heroLevel',
    wireToken: 'level',
    domainField: 'level',
    description: "The hero's level.",
    origin: 'english',
  },
  {
    symbol: 'heroEnergy',
    wireToken: 'energia_atual',
    domainField: 'energy',
    description: "The hero's current energy.",
    origin: 'portuguese',
  },
  {
    symbol: 'heroEnergyMax',
    wireToken: 'energia_max',
    domainField: 'energyMax',
    description: "The hero's maximum energy.",
    origin: 'portuguese',
  },
  {
    symbol: 'heroEnergyFraction',
    wireToken: 'energia_pct',
    domainField: 'energyFraction',
    description: 'Energy as a fraction of maximum, in [0, 1].',
    origin: 'portuguese',
  },
  {
    symbol: 'heroState',
    wireToken: 'state',
    domainField: 'activity',
    description: "The hero's rotation activity — see the state-value table below.",
    origin: 'english',
  },
  {
    symbol: 'heroOnField',
    wireToken: 'in_field',
    domainField: 'onField',
    description: 'Whether the hero is currently deployed to the field.',
    origin: 'english',
  },
  {
    symbol: 'heroInHouse',
    wireToken: 'in_casa',
    domainField: 'inHouse',
    description: 'Whether the hero is at the house.',
    origin: 'portuguese',
  },
  {
    symbol: 'heroRecovering',
    wireToken: 'recovering',
    domainField: 'recovering',
    description: 'Whether the hero is recovering energy.',
    origin: 'english',
  },
  {
    symbol: 'heroBattleAllowed',
    wireToken: 'battle_allowed',
    domainField: 'battleAllowed',
    description: 'Whether the hero is eligible for battle.',
    origin: 'english',
  },
  {
    symbol: 'houseActive',
    wireToken: 'active_casa',
    domainField: 'activeHouseIndex',
    description:
      '1-based index of the currently active house level on the wire — the snapshot field ' +
      'holds the 0-based equivalent, indexing directly into `houseLevels`.',
    origin: 'portuguese',
  },
  {
    symbol: 'houseLevels',
    wireToken: 'levels',
    domainField: 'houseLevels',
    description: 'The level unlocked at each house index.',
    origin: 'english',
  },
  {
    symbol: 'houseCycleSeconds',
    wireToken: 'cycle_secs',
    domainField: 'cycleSeconds',
    description: 'Seconds per rotation cycle at the active house level.',
    origin: 'english',
  },
  {
    symbol: 'houseSlots',
    wireToken: 'slots',
    domainField: 'slots',
    description: 'Field slots granted at the active house level.',
    origin: 'english',
  },
  {
    symbol: 'houseSlotsPerHouse',
    wireToken: 'slots_per_house',
    domainField: 'slotsPerHouse',
    description: 'Field slots granted at each house level.',
    origin: 'english',
  },
  {
    symbol: 'houseCycleSecondsPerHouse',
    wireToken: 'cycle_secs_per_house',
    domainField: 'cycleSecondsPerHouse',
    description: 'Rotation cycle seconds at each house level.',
    origin: 'english',
  },
  {
    symbol: 'houseUpgradeCost',
    wireToken: 'upgrade_cost',
    domainField: 'upgradeCost',
    description: 'Cost to upgrade from the active house level to the next.',
    origin: 'english',
  },
];

const STATE_ENTRIES: ReadonlyArray<{
  readonly symbol: RotationStateSymbol;
  readonly wireToken: string;
  readonly description: string;
}> = [
  { symbol: 'resting', wireToken: 'DESCANSANDO', description: 'The hero is resting/recovering at the house.' },
  { symbol: 'inField', wireToken: 'EM_CAMPO', description: 'The hero is deployed on the field.' },
  { symbol: 'benched', wireToken: 'NO_BANCO', description: 'The hero is benched (not battle-eligible).' },
  { symbol: 'ready', wireToken: 'PRONTO', description: 'The hero is fully recovered and waiting for a field slot.' },
];

/** Looks up a declared `/rotation` wire key by its stable symbol. The only sanctioned way for
 *  `normalize.ts` (or anything else in `rotation/` other than this file) to obtain a wire key
 *  string — see the module doc comment. */
export const wireKey = createWireKeyLookup<RotationWireSymbol>(KEY_ENTRIES, 'rotation-lexicon');

/** The domain symbol for a wire `state` token, or `undefined` for anything not in
 *  {@link STATE_ENTRIES} — an unrecognized token is a normalizer validation failure, not a
 *  lexicon lookup failure, so this returns `undefined` rather than throwing. */
export function stateSymbolForToken(token: string): RotationStateSymbol | undefined {
  return STATE_ENTRIES.find((candidate) => candidate.wireToken === token)?.symbol;
}

/** The full lexicon, keys and state values together, in declaration order — the source
 *  `../wire-glossary.js` and `vocabulary-guard.ts`'s forbidden-token pattern are built from. */
export const ROTATION_WIRE_LEXICON: readonly WireLexiconEntry[] = [
  ...KEY_ENTRIES.map((entry) => ({ ...entry, kind: 'key' as const })),
  ...STATE_ENTRIES.map((entry) => ({
    ...entry,
    kind: 'enum_value' as const,
    domainField: entry.symbol,
    origin: 'portuguese' as const,
  })),
];
