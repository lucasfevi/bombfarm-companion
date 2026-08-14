/**
 * MP5 F4 (T9) — the web's half of `AD-062`/`AD-089`: a locally stored planner account that
 * predates the 2026-08-13 game reset is dropped whole, never migrated, never served.
 *
 * Reads RAW `localStorage` strings, never `loadAccountShared`/`normalizeAccount` — F3's
 * `normalizeTree` (`account-shared.ts`) is a fixed-field-list rebuild that silently DISCARDS
 * every retired field on load. By the time a normalized value exists, the evidence this module
 * looks for is already gone; reading it would make the drop a permanent no-op that passes its
 * own tests. This is why `dropStaleLocalAccount()` must run BEFORE any `normalize*` call —
 * `hydratePlannerStore()` runs it as its first statement, ahead of `loadHeroes()`.
 *
 * Supersedes `MSC-10` for keystone-carrying records (`AD-089`): F3's
 * `storage-legacy-keystone-fields.test.ts` asserted such a record loads and keeps every
 * survivor. Under this feature it is dropped whole instead — see that file's own rewritten
 * header for the supersession statement.
 */

/** The five retired `TreeState` fields (MP5 F2/F3 removed them from the type) plus the legacy
 *  `keystones` list a pre-removal record may still carry. */
export const RETIRED_TREE_FIELDS = ['abisso', 'abissoBase', 'critDmgMult', 'glassCannon', 'tempoDobrado', 'keystones'] as const;

/** Every key a drop clears — the public `bf-hp-*` keys (design §5.6) plus the legacy `bf-pa-*`
 *  keys `loadHeroes`/`loadAccountShared`/`getActiveHeroId` still migrate from. Includes
 *  `bf-hp-active-hero-v1`: a pointer into a roster that is being deleted is a dangling id, and
 *  leaving it would let `getActiveHeroId` migrate a legacy pointer back in. */
export const DROPPED_KEYS = [
  'bf-hp-account-v1',
  'bf-hp-heroes-v1',
  'bf-hp-inventory-v1',
  'bf-hp-active-hero-v1',
  'bf-pa-account-v1',
  'bf-pa-heroes-v2',
  'bf-pa-heroes-v1',
  'bf-pa-active-hero-v2',
  'bf-pa-active-hero-v1',
] as const;

export interface DropReport {
  readonly dropped: boolean;
  /** Path-qualified field names that triggered the drop — never a stored value (MSG-28). */
  readonly triggers: readonly string[];
  readonly cleared: readonly string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** MSG-21: trigger is field PRESENCE, not truthiness — an all-`false` tree still predates the
 *  wipe. `field in tree`, never `tree[field]`. */
function treeTriggers(tree: unknown, label: string): string[] {
  if (!isObject(tree)) return [];
  const hits: string[] = [];
  for (const field of RETIRED_TREE_FIELDS) {
    if (field in tree) hits.push(`${label}.${field}`);
  }
  return hits;
}

/** MSG-24: an unavailable/throwing `localStorage.getItem` contributes no trigger — a store
 *  failure must never be reported as a drop, and must never throw into the caller. */
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** An unparseable value contributes no trigger — it is not evidence of a keystone record. */
function safeParse(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function heroArrayTriggers(raw: unknown, label: string): string[] {
  if (!Array.isArray(raw)) return [];
  const hits: string[] = [];
  raw.forEach((hero, index) => {
    if (isObject(hero)) hits.push(...treeTriggers(hero.tree, `${label}[${index}].tree`));
  });
  return hits;
}

/**
 * Scans `bf-hp-account-v1`'s `tree`, every element of `bf-hp-heroes-v1`'s deprecated per-hero
 * `tree` copy, and the legacy `bf-pa-*` equivalents, reading raw strings only. On any trigger,
 * clears every key in {@link DROPPED_KEYS} — each `removeItem` individually try/caught so one
 * quota/security error cannot abort the rest — and returns a report naming what fired. Never
 * throws. Never populates in-memory state itself; the caller (`hydratePlannerStore`) proceeds to
 * its normal (now-empty) load only after this returns.
 */
export function dropStaleLocalAccount(): DropReport {
  const triggers: string[] = [
    ...treeTriggers((safeParse(safeGetItem('bf-hp-account-v1')) as Record<string, unknown> | null)?.tree, 'account.tree'),
    ...heroArrayTriggers(safeParse(safeGetItem('bf-hp-heroes-v1')), 'heroes'),
    ...treeTriggers(
      (safeParse(safeGetItem('bf-pa-account-v1')) as Record<string, unknown> | null)?.tree,
      'bf-pa-account-v1.tree',
    ),
    ...heroArrayTriggers(safeParse(safeGetItem('bf-pa-heroes-v2')), 'bf-pa-heroes-v2'),
    ...heroArrayTriggers(safeParse(safeGetItem('bf-pa-heroes-v1')), 'bf-pa-heroes-v1'),
  ];

  if (triggers.length === 0) {
    return { dropped: false, triggers: [], cleared: [] };
  }

  const cleared: string[] = [];
  for (const key of DROPPED_KEYS) {
    try {
      localStorage.removeItem(key);
      cleared.push(key);
    } catch {
      // MSG-24 / the quota edge case: one key's removeItem throw must not abort the rest, and
      // must not let the caller proceed as if the drop fully succeeded when it partially did —
      // `cleared` reports exactly what was actually removed.
    }
  }

  // MSG-28: field names only, never a stored value — a hero name or gold amount never reaches
  // this payload because `triggers`/`cleared`/`DROPPED_KEYS` are all key/path names by
  // construction, not data read from the records themselves.
  console.info('[stale-account] dropped a stored planner account that predates the game reset', {
    surface: 'web',
    keys: DROPPED_KEYS,
    triggers,
  });

  return { dropped: true, triggers, cleared };
}
