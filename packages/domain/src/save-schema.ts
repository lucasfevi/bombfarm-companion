/**
 * MP5 F4 (`AD-086`, `AD-087`) — the declared-path schema engine and the shared level catalogue.
 *
 * The fingerprint model that shipped before this feature (`RouteFingerprint.requiredKeys`) was a
 * flat top-level key list checked as a subset: `Object.keys(body)` at the top level only, missing
 * keys fatal, added keys silently logged and never gated. That model is structurally incapable of
 * seeing a nested removal, a nested addition, or an addition anywhere — which is exactly how the
 * 2026-08-13 game patch got past it (spec.md's Problem Statement).
 *
 * This module replaces it with a **declared-path** engine: every level names its complete key set
 * plus two named, enumerated escapes (`optional` — the game legitimately varies; `allowance` — our
 * own committed artifact scrubbed a key), and descent happens only where a level explicitly
 * declares a child. An added key at any declared level is fatal. Nothing here names a retired
 * pre-patch vocabulary token — `packages/domain/tests/source-surface.test.ts`'s hard zero
 * enforces that for this whole package, and this file adds no exception to it.
 */

export interface SchemaLevel {
  /** Complete required key set for this object. Exact — see `optional`/`allowance` for the only escapes. */
  readonly keys: readonly string[];
  /** Keys the GAME emits only sometimes. Enumerated, never a wildcard. e.g. `item.slot`. */
  readonly optional?: readonly string[];
  /** Keys OUR committed artifact removed (e.g. the account_id/player_name scrub). Enumerated. */
  readonly allowance?: readonly string[];
  /** Declared descents only. A key absent from here is never descended into. */
  readonly children?: Readonly<Record<string, SchemaChild>>;
}

export type SchemaChild =
  | { readonly kind: 'object'; readonly level: SchemaLevel }
  | { readonly kind: 'array'; readonly element: SchemaLevel }
  | { readonly kind: 'valueMap' }
  | { readonly kind: 'valueList' };

export interface SchemaFingerprint {
  /** Path prefix on every reported key: `'skills'` | `'save'` | … */
  readonly root: string;
  readonly level: SchemaLevel;
  readonly gameBuild: string;
  readonly capturedAt: string;
  /** MSG-30: the committed artifact and capture this key set was authored from. */
  readonly sourceArtifact: string;
}

export type SchemaCheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly missingKeys: readonly string[]; readonly addedKeys: readonly string[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks one declared level at `path`, appending path-qualified findings into the shared
 * `missing`/`added` accumulators. Never throws — a wrong container kind is reported as a missing
 * key at its own path (engine rule 1 / 4), never descended into, never fatal to the caller.
 */
function checkLevel(
  value: unknown,
  level: SchemaLevel,
  path: string,
  missing: string[],
  added: string[],
): void {
  if (!isPlainObject(value)) {
    missing.push(path);
    return;
  }

  const bodyKeys = new Set(Object.keys(value));
  const escapes = new Set([...(level.optional ?? []), ...(level.allowance ?? [])]);

  for (const key of level.keys) {
    if (!bodyKeys.has(key)) missing.push(`${path}.${key}`);
  }
  for (const key of bodyKeys) {
    if (!level.keys.includes(key) && !escapes.has(key)) added.push(`${path}.${key}`);
  }

  if (!level.children) return;

  for (const [key, child] of Object.entries(level.children)) {
    if (!bodyKeys.has(key)) continue; // already reported as missing above, per its declaration in `keys`
    const childValue = value[key];
    const childPath = `${path}.${key}`;

    switch (child.kind) {
      case 'object':
        checkLevel(childValue, child.level, childPath, missing, added);
        break;
      case 'array':
        if (!Array.isArray(childValue)) {
          missing.push(childPath);
          break;
        }
        childValue.forEach((element, index) => {
          checkLevel(element, child.element, `${childPath}[${index}]`, missing, added);
        });
        break;
      case 'valueMap':
        // MSG-07: presence + container kind only. Entries are game data, never schema.
        if (!isPlainObject(childValue)) missing.push(childPath);
        break;
      case 'valueList':
        if (!Array.isArray(childValue)) missing.push(childPath);
        break;
    }
  }
}

/**
 * Checks `value` against `fingerprint`. Returns `{ok:true}` or a not-`ok` result naming every
 * missing and every added key, path-qualified from `fingerprint.root`. Never throws.
 */
export function checkSchema(value: unknown, fingerprint: SchemaFingerprint): SchemaCheckResult {
  const missingKeys: string[] = [];
  const addedKeys: string[] = [];
  checkLevel(value, fingerprint.level, fingerprint.root, missingKeys, addedKeys);

  if (missingKeys.length === 0 && addedKeys.length === 0) return { ok: true };
  return { ok: false, missingKeys, addedKeys };
}

/**
 * MSG-06 / AD-087 anti-vacuity #1: a declared array that is empty in a committed corpus checked
 * `every element` vacuously — nothing was actually asserted. Callers (T4/T5's corpus suites) run
 * this against the real fixture arrays; this file has no corpus of its own yet.
 */
export function assertNonEmptyCorpusArray(array: readonly unknown[], path: string): void {
  if (array.length === 0) {
    throw new Error(
      `[save-schema] declared array at "${path}" is empty in the committed corpus — the ` +
        'per-element check would pass vacuously.',
    );
  }
}

/**
 * AD-087 anti-vacuity #2: an `optional` key is a reviewable escape only if the committed corpus
 * demonstrates BOTH sides — at least one element carrying it, at least one lacking it. A key that
 * is never omitted should not be `optional`; a key that is never carried is dead.
 */
export function assertOptionalKeyWitnessedBothWays(
  elements: readonly Record<string, unknown>[],
  key: string,
  path: string,
): void {
  const present = elements.some((element) => key in element);
  const absent = elements.some((element) => !(key in element));

  if (!present) {
    throw new Error(`[save-schema] optional key "${key}" at "${path}" is never present in the committed corpus — dead optional.`);
  }
  if (!absent) {
    throw new Error(`[save-schema] optional key "${key}" at "${path}" is never absent in the committed corpus — vacuous optional.`);
  }
}

// --- The shared level catalogue (design §2.3) -----------------------------------------------
//
// Measured from `packages/game-api/src/__fixtures__/api-bodies.json` (API, scrubbed 2026-08-12)
// and `packages/domain/tests/fixtures/sheet-math/save-20260813-5heroes.json` (export, scrubbed
// 2026-08-13). Key-set identical across both sources — this is the "one catalogue" MSG-17 asks
// for the export fingerprint and route fingerprints to both compose from.

const SKILLS_TOTALS_LEVEL: SchemaLevel = {
  keys: [
    'team_dmg_add',
    'crit_chance_add',
    'crit_dmg_add',
    'speed_add',
    'coin_add',
    'luck_add',
    'energia_add',
    'xp_mult',
    'geo_mult',
    'dmg_static',
    'vagas_campo',
    'bag_tabs_bonus',
  ],
};

const SKILLS_LEVEL: SchemaLevel = {
  keys: ['levels', 'refunds', 'field_slots', 'bag_tabs', 'gold', 'max_phase', 'totals'],
  children: {
    // Skill-node ids / refund entries are game data, not schema (MSG-07) — only presence matters.
    levels: { kind: 'valueMap' },
    refunds: { kind: 'valueMap' },
    totals: { kind: 'object', level: SKILLS_TOTALS_LEVEL },
  },
};

const HERO_LEVEL: SchemaLevel = {
  keys: [
    'id',
    'name',
    'level',
    'xp',
    'rarity',
    'rank',
    'stars',
    'skin',
    'skin_birth',
    'in_field',
    'battle_allowed',
    'marketable',
    'in_market',
    'slots',
    'stats',
    'birth_stats',
    'stat_ranges',
    'abilities',
    'ability_points_total',
    'ability_points_spent',
    'ability_reroll_cost',
    'ability_reroll_stone',
    'stat_points_available',
  ],
  // `stats`/`birth_stats`/`stat_ranges`/`abilities`/`slots` are value-shaped, not schema-shaped —
  // deliberately NOT declared as children: they are neither fingerprinted nor descended (design
  // §2.3). Their presence is still covered because they are keys of this level.
};

const ITEM_LEVEL: SchemaLevel = {
  keys: [
    'id',
    'def_id',
    'set',
    'rarity',
    'category',
    'level',
    'stats',
    'power',
    'sell_value',
    'sellable',
    'upgrade',
    'tradable',
    'market_state',
    'locked',
    'equipped_on',
    'equip_slot',
    'in_stash',
  ],
  // Measured (design §2.4): `/inventory.items` 27 with `slot` / 3 without (all category 4);
  // `save.items` 17 with / 5 without. Genuine game variance, not our artifact — `optional`, not
  // `allowance`. `assertOptionalKeyWitnessedBothWays` keeps this escape from ever going dead.
  optional: ['slot'],
};

const CASA_LEVEL: SchemaLevel = {
  keys: ['active_casa', 'levels', 'cycle_secs', 'slots', 'slots_per_house', 'cycle_secs_per_house', 'upgrade_cost'],
  children: {
    // House-indexed arrays are game data, not schema (MSG-07) — only presence/container kind matters.
    levels: { kind: 'valueList' },
    slots_per_house: { kind: 'valueList' },
    cycle_secs_per_house: { kind: 'valueList' },
    upgrade_cost: { kind: 'valueList' },
  },
};

/** The five shared levels — key-set identical across the API routes and the save export. */
export const SCHEMA_LEVELS = {
  skills: SKILLS_LEVEL,
  skillsTotals: SKILLS_TOTALS_LEVEL,
  hero: HERO_LEVEL,
  item: ITEM_LEVEL,
  casa: CASA_LEVEL,
} as const satisfies Record<string, SchemaLevel>;
