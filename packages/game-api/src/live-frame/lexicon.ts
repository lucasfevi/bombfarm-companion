/**
 * The live combat-frame wire lexicon. The combat websocket's `snap` tick packs its whole payload
 * into single-letter and abbreviated keys (`e`, `w`, `c`, `d`, `cr`) beside a handful of
 * Portuguese-origin ones (`jaula_*`, `seca_secs`) — this table is the one place that vocabulary is
 * translated into this codebase's own English domain field names, the same job
 * `../rotation/lexicon.ts` does for the `/rotation` route, extended to cover abbreviations as well
 * as foreign-language tokens. `tls-stream.ts` and its fixture generator reference a wire token only
 * through {@link wireKey} below, never as an inline string literal.
 *
 * This lexicon is a dictionary of the wire protocol as observed, not a manifest of what the
 * decoder currently reads — several entries below (`bombs`, `explosions`, `rot_events`, `auras`,
 * `kinds`/`hps`, and a few per-hero fields) are declared for documentation but not yet consumed by
 * `toLiveTick`. Where a field's meaning was not established from the capture this lexicon is built
 * from, its description says so plainly instead of guessing — see `heroFieldZ`, `heroSkillState`,
 * the `aura*` fields, `boss`, `gate`, `swapSeconds`, and the `cage*`/`droughtSeconds` group.
 */

import { createWireKeyLookup, type WireLexiconEntry } from '../wire-lexicon.js';

/** Every declared live-frame wire KEY, key-shaped entries only — the enum-shaped `snap` value of
 *  `t` is declared separately below and combined into {@link LIVE_FRAME_WIRE_LEXICON}. */
export type LiveFrameWireSymbol =
  | 'messageType'
  | 'phase'
  | 'wave'
  | 'maxPhase'
  | 'gold'
  | 'roomHp'
  | 'idle'
  | 'locked'
  | 'noKey'
  | 'gate'
  | 'gateFailed'
  | 'heroesList'
  | 'bombsList'
  | 'hitsList'
  | 'explosionsList'
  | 'lootList'
  | 'rotEventsList'
  | 'aurasList'
  | 'kindsList'
  | 'hpsList'
  | 'boss'
  | 'swapSeconds'
  | 'cageState'
  | 'cageSeconds'
  | 'cageCeiling'
  | 'cageAto'
  | 'droughtSeconds'
  | 'heroId'
  | 'heroEnergyFraction'
  | 'heroX'
  | 'heroY'
  | 'heroActionState'
  | 'heroMoveSpeed'
  | 'heroCell'
  | 'heroFieldZ'
  | 'heroSkillState'
  | 'lootCell'
  | 'lootGold'
  | 'hitCell'
  | 'hitDamage'
  | 'hitCritical'
  | 'bombCell'
  | 'bombFuseRemainingSeconds'
  | 'bombFuseTotalSeconds'
  | 'bombRadius'
  | 'explosionCell'
  | 'explosionRadius'
  | 'rotEventName'
  | 'rotEventHeroId'
  | 'rotEventSeconds'
  | 'auraFieldC'
  | 'auraFieldM'
  | 'auraFieldN'
  | 'bonusSeconds'
  | 'bonusMultiplier';

const KEY_ENTRIES: ReadonlyArray<{
  readonly symbol: LiveFrameWireSymbol;
  readonly wireToken: string;
  readonly domainField: string;
  readonly description: string;
  readonly origin: 'portuguese' | 'english';
}> = [
  {
    symbol: 'messageType',
    wireToken: 't',
    domainField: 'messageType',
    description: 'Message-type discriminator on every frame this decoder recognizes.',
    origin: 'english',
  },
  { symbol: 'phase', wireToken: 'phase', domainField: 'phase', description: 'Current phase number.', origin: 'english' },
  { symbol: 'wave', wireToken: 'wave', domainField: 'wave', description: 'Current wave number within the phase.', origin: 'english' },
  {
    symbol: 'maxPhase',
    wireToken: 'max_phase',
    domainField: 'maxPhase',
    description: "The account's highest unlocked phase number.",
    origin: 'english',
  },
  {
    symbol: 'gold',
    wireToken: 'gold',
    domainField: 'gold',
    description:
      'Current gold balance. Arrives on the wire as a digit string (observed "9724194"…"10294318"), not a ' +
      'number — a malformed value must be rejected rather than propagated.',
    origin: 'english',
  },
  {
    symbol: 'roomHp',
    wireToken: 'room_hp',
    domainField: 'roomHp',
    description: 'Remaining room/encounter HP, observed on a 0–255 scale.',
    origin: 'english',
  },
  { symbol: 'idle', wireToken: 'idle', domainField: 'idle', description: 'The server\'s own "nothing is being fought" flag.', origin: 'english' },
  { symbol: 'locked', wireToken: 'locked', domainField: 'locked', description: 'Whether the room is currently locked.', origin: 'english' },
  {
    symbol: 'noKey',
    wireToken: 'no_key',
    domainField: 'noKey',
    description: 'Whether the account lacks the key needed for this room.',
    origin: 'english',
  },
  {
    symbol: 'gate',
    wireToken: 'gate',
    domainField: 'gate',
    description: 'Numeric field observed alongside `gate_failed`. Meaning not established from this capture.',
    origin: 'english',
  },
  {
    symbol: 'gateFailed',
    wireToken: 'gate_failed',
    domainField: 'gateFailed',
    description: 'Whether the `gate` action failed.',
    origin: 'english',
  },
  {
    symbol: 'heroesList',
    wireToken: 'heroes',
    domainField: 'heroes',
    description: 'Per-hero live state, one entry per hero currently on the field.',
    origin: 'english',
  },
  { symbol: 'bombsList', wireToken: 'bombs', domainField: 'bombs', description: 'Live bomb state on the field.', origin: 'english' },
  { symbol: 'hitsList', wireToken: 'hits', domainField: 'hits', description: 'Damage events landed this tick.', origin: 'english' },
  {
    symbol: 'explosionsList',
    wireToken: 'explosions',
    domainField: 'explosions',
    description: 'Bomb explosions this tick.',
    origin: 'english',
  },
  { symbol: 'lootList', wireToken: 'loot', domainField: 'loot', description: 'Props that paid out this tick.', origin: 'english' },
  {
    symbol: 'rotEventsList',
    wireToken: 'rot_events',
    domainField: 'rotEvents',
    description: 'Rotation-related events this tick.',
    origin: 'english',
  },
  {
    symbol: 'aurasList',
    wireToken: 'auras',
    domainField: 'auras',
    description: "Active aura entries. Each entry's own fields (`c`, `m`, `n`) are not established from this capture.",
    origin: 'english',
  },
  {
    symbol: 'kindsList',
    wireToken: 'kinds',
    domainField: 'kinds',
    description: 'Parallel array over map props, paired index-for-index with `hps`; `-1` marks a cleared slot.',
    origin: 'english',
  },
  {
    symbol: 'hpsList',
    wireToken: 'hps',
    domainField: 'hps',
    description: 'Parallel array over map props, paired index-for-index with `kinds`; `-1` marks a cleared slot.',
    origin: 'english',
  },
  { symbol: 'boss', wireToken: 'boss', domainField: 'boss', description: 'Meaning not established from this capture.', origin: 'english' },
  {
    symbol: 'swapSeconds',
    wireToken: 'swap_secs',
    domainField: 'swapSeconds',
    description: 'A seconds value; what it counts down is not established from this capture.',
    origin: 'english',
  },
  {
    symbol: 'cageState',
    wireToken: 'jaula_state',
    domainField: 'cageState',
    description: 'Portuguese `jaula` = cage. Purpose within the live encounter not established from this capture.',
    origin: 'portuguese',
  },
  {
    symbol: 'cageSeconds',
    wireToken: 'jaula_secs',
    domainField: 'cageSeconds',
    description: 'Portuguese `jaula` = cage. Purpose within the live encounter not established from this capture.',
    origin: 'portuguese',
  },
  {
    symbol: 'cageCeiling',
    wireToken: 'jaula_teto',
    domainField: 'cageCeiling',
    description:
      'Portuguese `jaula` = cage, `teto` = ceiling/cap. Purpose within the live encounter not established from ' +
      'this capture.',
    origin: 'portuguese',
  },
  {
    symbol: 'cageAto',
    wireToken: 'jaula_ato',
    domainField: 'cageAto',
    description: 'Portuguese `jaula` = cage. Purpose within the live encounter not established from this capture.',
    origin: 'portuguese',
  },
  {
    symbol: 'droughtSeconds',
    wireToken: 'seca_secs',
    domainField: 'droughtSeconds',
    description: 'Portuguese `seca` = drought/dry spell. Purpose within the live encounter not established from this capture.',
    origin: 'portuguese',
  },
  { symbol: 'heroId', wireToken: 'id', domainField: 'id', description: 'Hero id.', origin: 'english' },
  {
    symbol: 'heroEnergyFraction',
    wireToken: 'e',
    domainField: 'energyFraction',
    description: "Fraction of the hero's own energy pool, in [0, 1] (observed 0.021–0.9998).",
    origin: 'english',
  },
  { symbol: 'heroX', wireToken: 'x', domainField: 'x', description: 'Map x position (0–18 observed).', origin: 'english' },
  { symbol: 'heroY', wireToken: 'y', domainField: 'y', description: 'Map y position (0–15 observed).', origin: 'english' },
  {
    symbol: 'heroActionState',
    wireToken: 's',
    domainField: 'actionState',
    description: 'Action-state code (0–5 observed); `5` has been observed meaning walking. Other values not established.',
    origin: 'english',
  },
  {
    symbol: 'heroMoveSpeed',
    wireToken: 'w',
    domainField: 'moveSpeed',
    description:
      'Move speed in x/y units per second (2.11–2.43 observed) — a speed, not a period; do not invert it.',
    origin: 'english',
  },
  {
    symbol: 'heroCell',
    wireToken: 'c',
    domainField: 'cell',
    description:
      'Map cell index the hero occupies — the same index space as `loot[].cell`, `hits[].cell`, ' +
      '`bombs[].cell`, `explosions[].cell`.',
    origin: 'english',
  },
  {
    symbol: 'heroFieldZ',
    wireToken: 'z',
    domainField: 'z',
    description: 'Boolean field. Meaning not established from this capture.',
    origin: 'english',
  },
  {
    symbol: 'heroSkillState',
    wireToken: 'sk',
    domainField: 'sk',
    description: 'Numeric field (0–6 observed). Meaning not established from this capture.',
    origin: 'english',
  },
  { symbol: 'lootCell', wireToken: 'c', domainField: 'cell', description: 'Index of the map cell the destroyed prop stood in.', origin: 'english' },
  {
    symbol: 'lootGold',
    wireToken: 'g',
    domainField: 'gold',
    description:
      'Gold this prop paid out. Arrives on the wire as a digit string (observed "1580"…"6636"), not a number — a ' +
      'malformed value must be rejected rather than propagated.',
    origin: 'english',
  },
  { symbol: 'hitCell', wireToken: 'c', domainField: 'cell', description: 'Index of the map cell the hit landed in.', origin: 'english' },
  { symbol: 'hitDamage', wireToken: 'd', domainField: 'damage', description: 'Damage dealt (179–107101 observed).', origin: 'english' },
  { symbol: 'hitCritical', wireToken: 'cr', domainField: 'critical', description: 'Whether the hit was a critical.', origin: 'english' },
  { symbol: 'bombCell', wireToken: 'c', domainField: 'cell', description: 'Index of the map cell the bomb sits in.', origin: 'english' },
  {
    symbol: 'bombFuseRemainingSeconds',
    wireToken: 'f',
    domainField: 'fuseRemainingSeconds',
    description: 'Fuse remaining, seconds (0.02–1.93 observed).',
    origin: 'english',
  },
  {
    symbol: 'bombFuseTotalSeconds',
    wireToken: 'ft',
    domainField: 'fuseTotalSeconds',
    description: 'Fuse total, seconds (1.92–1.99 observed).',
    origin: 'english',
  },
  { symbol: 'bombRadius', wireToken: 'r', domainField: 'radius', description: 'Blast radius in cells (1–3 observed).', origin: 'english' },
  { symbol: 'explosionCell', wireToken: 'c', domainField: 'cell', description: 'Index of the map cell the explosion is centred on.', origin: 'english' },
  { symbol: 'explosionRadius', wireToken: 'r', domainField: 'radius', description: 'Blast radius in cells.', origin: 'english' },
  { symbol: 'rotEventName', wireToken: 'ev', domainField: 'event', description: 'Rotation-event name.', origin: 'english' },
  { symbol: 'rotEventHeroId', wireToken: 'hero', domainField: 'heroId', description: 'Hero id the event concerns.', origin: 'english' },
  {
    symbol: 'rotEventSeconds',
    wireToken: 'secs',
    domainField: 'seconds',
    description: 'Seconds value carried by the event (20–840 observed).',
    origin: 'english',
  },
  { symbol: 'auraFieldC', wireToken: 'c', domainField: 'c', description: 'Meaning not established from this capture.', origin: 'english' },
  { symbol: 'auraFieldM', wireToken: 'm', domainField: 'm', description: 'Meaning not established from this capture.', origin: 'english' },
  { symbol: 'auraFieldN', wireToken: 'n', domainField: 'n', description: 'Meaning not established from this capture.', origin: 'english' },
  {
    symbol: 'bonusSeconds',
    wireToken: 'bonus_secs',
    domainField: 'bonusSeconds',
    description:
      'Seconds remaining in a gold-bonus window. Absent from the capture this lexicon is built from — it was ' +
      'taken outside a bonus window — but documented as arriving per tick during one.',
    origin: 'english',
  },
  {
    symbol: 'bonusMultiplier',
    wireToken: 'bonus_mult',
    domainField: 'bonusMultiplier',
    description:
      'Gold-bonus multiplier active during a bonus window. Absent from the capture this lexicon is built from — ' +
      'documented as arriving per tick during one, alongside `bonus_secs`.',
    origin: 'english',
  },
];

/** The one enum-shaped live-frame wire value: `t`'s only observed content. */
const ENUM_ENTRIES: ReadonlyArray<{
  readonly symbol: 'snapMessageType';
  readonly wireToken: string;
  readonly description: string;
}> = [{ symbol: 'snapMessageType', wireToken: 'snap', description: 'The only observed value of `t`: a live combat-frame snapshot tick.' }];

/** Looks up a declared live-frame wire key (or the `snap` message-type value — {@link
 *  ENUM_ENTRIES} shares this key-entry table's symbol space) by its stable symbol. The only
 *  sanctioned way for `tls-stream.ts` and its fixture generator to obtain a wire token string —
 *  see the module doc comment. */
export const wireKey = createWireKeyLookup<LiveFrameWireSymbol | 'snapMessageType'>(
  [...KEY_ENTRIES, ...ENUM_ENTRIES.map((entry) => ({ ...entry, domainField: entry.symbol, origin: 'english' as const }))],
  'live-frame-lexicon',
);

/** The full lexicon, keys and the `snap` enum value together, in declaration order — the source
 *  `../wire-glossary.js` and `vocabulary-guard.ts`'s forbidden-token pattern are built from. */
export const LIVE_FRAME_WIRE_LEXICON: readonly WireLexiconEntry[] = [
  ...KEY_ENTRIES.map((entry) => ({ ...entry, kind: 'key' as const })),
  ...ENUM_ENTRIES.map((entry) => ({
    ...entry,
    kind: 'enum_value' as const,
    domainField: entry.symbol,
    origin: 'english' as const,
  })),
];
