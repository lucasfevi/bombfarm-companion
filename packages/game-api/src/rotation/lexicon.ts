/**
 * The rotation wire lexicon. `/rotation`'s wire body mixes
 * Portuguese and English keys (`casa` beside `cycle_secs`, `energia_atual` beside `battle_allowed`)
 * — this table is the one place that vocabulary is translated into this codebase's own English
 * domain field names. `normalize.ts` and everything else under `rotation/` reference a wire token
 * only through {@link wireKey}/{@link stateSymbolForToken} below, never as an inline string
 * literal — {@link PORTUGUESE_WIRE_TOKENS} is what `vocabulary-guard.ts` builds its forbidden
 * pattern from, so a literal here would make the guard unable to forbid itself out of its own
 * scan surface.
 *
 * This only covers the rotation boundary this feature builds. It does not migrate the many
 * pre-existing Portuguese identifiers elsewhere in the tree (`packages/domain`'s `SchemaLevel`
 * key lists, `packages/contracts`'s `RawHeroEnergy`, and others) — that is separate, out-of-scope
 * work.
 */

export type WireVocabularyOrigin = 'portuguese' | 'english';
export type WireVocabularyKind = 'key' | 'enum_value';

export interface WireLexiconEntry {
  /** Stable, code-facing identifier used to look this entry up — never the wire token itself. */
  readonly symbol: string;
  readonly wireToken: string;
  readonly kind: WireVocabularyKind;
  readonly domainField: string;
  readonly description: string;
  readonly origin: WireVocabularyOrigin;
}

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

/** The `state` wire value observed in the committed rotation fixture. Only three tokens are
 *  present there (`DESCANSANDO`, `EM_CAMPO`, `NO_BANCO`) — a fourth was not found. */
export type RotationStateSymbol = 'resting' | 'inField' | 'benched';

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
];

/** Looks up a declared `/rotation` wire key by its stable symbol. The only sanctioned way for
 *  `normalize.ts` (or anything else in `rotation/` other than this file) to obtain a wire key
 *  string — see the module doc comment. */
export function wireKey(symbol: RotationWireSymbol): string {
  const entry = KEY_ENTRIES.find((candidate) => candidate.symbol === symbol);
  if (!entry) {
    throw new Error(`[rotation-lexicon] no entry declared for wire key symbol "${symbol}"`);
  }
  return entry.wireToken;
}

/** The domain symbol for a wire `state` token, or `undefined` for anything not in
 *  {@link STATE_ENTRIES} — an unrecognized token is a normalizer validation failure, not a
 *  lexicon lookup failure, so this returns `undefined` rather than throwing. */
export function stateSymbolForToken(token: string): RotationStateSymbol | undefined {
  return STATE_ENTRIES.find((candidate) => candidate.wireToken === token)?.symbol;
}

/** The full lexicon, keys and state values together, in declaration order — the source both
 *  {@link renderWireGlossary} and `vocabulary-guard.ts`'s forbidden-token pattern are built from. */
export const ROTATION_WIRE_LEXICON: readonly WireLexiconEntry[] = [
  ...KEY_ENTRIES.map((entry) => ({ ...entry, kind: 'key' as const })),
  ...STATE_ENTRIES.map((entry) => ({
    ...entry,
    kind: 'enum_value' as const,
    domainField: entry.symbol,
    origin: 'portuguese' as const,
  })),
];

/** Every Portuguese-origin wire token declared above — keys and `state` values alike. The
 *  vocabulary guard's forbidden-identifier pattern is built from exactly this list, never from a
 *  hand-written literal, so the guard cannot drift from the table that is supposed to be its only
 *  source of truth. */
export const PORTUGUESE_WIRE_TOKENS: readonly string[] = ROTATION_WIRE_LEXICON.filter(
  (entry) => entry.origin === 'portuguese',
).map((entry) => entry.wireToken);

function glossaryTable(title: string, rows: readonly WireLexiconEntry[]): readonly string[] {
  const lines = [`## ${title}`, '', '| Wire token | Domain field | Description | Origin |', '| --- | --- | --- | --- |'];
  for (const row of rows) {
    const origin = row.origin === 'portuguese' ? 'Portuguese' : 'English';
    lines.push(`| \`${row.wireToken}\` | \`${row.domainField}\` | ${row.description} | ${origin} |`);
  }
  lines.push('');
  return lines;
}

/**
 * Renders this lexicon as the `docs/wire-vocabulary.md` markdown body. Pure — no filesystem
 * access, no clock — so `tools/generate-wire-glossary.mjs` can write its return value verbatim,
 * and the staleness test can compare it byte-for-byte against the committed doc.
 */
export function renderWireGlossary(): string {
  const header = [
    '# Rotation wire vocabulary',
    '',
    '<!-- generated — do not edit by hand, run `pnpm generate:wire-vocabulary` -->',
    '',
    "The `/rotation` route mixes Portuguese and English wire vocabulary. This is the one place " +
      "that vocabulary is translated into this codebase's own English domain field names — see " +
      '`packages/game-api/src/rotation/lexicon.ts`. It covers only the rotation boundary; the ' +
      'rest of the tree still carries pre-existing Portuguese identifiers that this table does ' +
      'not inventory.',
    '',
  ];

  const keyRows = ROTATION_WIRE_LEXICON.filter((entry) => entry.kind === 'key');
  const enumRows = ROTATION_WIRE_LEXICON.filter((entry) => entry.kind === 'enum_value');

  const body = [...glossaryTable('Keys', keyRows), ...glossaryTable('`state` values', enumRows)];

  return [...header, ...body].join('\n').trimEnd() + '\n';
}
