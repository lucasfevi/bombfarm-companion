import type { AccountSection } from '@bombfarm/contracts';
import {
  checkSchema,
  SCHEMA_LEVELS,
  type SchemaFingerprint,
  type SchemaLevel,
} from '@bombfarm/domain/save-schema';

/**
 * MP5 F4 — deepened per-route schema fingerprints (`AD-086`). The spec's sharpest finding
 * (spec.md Problem Statement) is that the fingerprint this replaces — a flat top-level required-
 * key LIST checked as a SUBSET — was authored from the already-drifted 2026-08-12 capture and
 * silently adopted the new shape as its own baseline: the `skills` section's required-key list
 * already named `refunds`, a key the 2026-08-13 patch added. A subset assertion cannot fail on an
 * addition, and cannot fail on a removal either once the list was transcribed from the body it
 * checks.
 *
 * `RouteFingerprint` is now an alias of `@bombfarm/domain/save-schema`'s `SchemaFingerprint`:
 * every declared level names its COMPLETE key set (an added key is fatal, `MSG-02`/`MSG-03`), and
 * descent reaches the nested paths that actually drifted (`skills.totals`, `MSG-01`).
 *
 * MSG-30: the required key sets below are the real top-level (and now nested) keys of the
 * 2026-08-12 capture (`bombfarm-bot/data/anchor-calibration-2026-08-12T13-15-38-t1c/api-bodies.json`,
 * scrubbed and copied into `src/__fixtures__/api-bodies.json`) — each fingerprint below names that
 * artifact and capture directly via `sourceArtifact`, rather than only in this file-level comment.
 *
 * `account_id` and `player_name` are declared `allowance` (never `keys`) on `/state`: they are the
 * two fields the scrub removes (matching this file's own committed fixture), and requiring them
 * would make the scrubbed fixture fail its own guard.
 */
export type RouteFingerprint = SchemaFingerprint;

const GAME_BUILD = '0.1.0.0+2026-08-11T21:38:23Z';
const CAPTURED_AT = '2026-08-12T13:15:38.000Z';
const SOURCE_ARTIFACT = 'packages/game-api/src/__fixtures__/api-bodies.json — 2026-08-12 capture';

/** `/rotation.heroes[]` — a sixth declared element level, distinct from the export/API roster
 *  hero. One variant across 8 elements in the committed corpus (design §2.3). */
const ROTATION_HERO_LEVEL: SchemaLevel = {
  keys: [
    'id',
    'level',
    'energia_atual',
    'energia_max',
    'energia_pct',
    'state',
    'in_field',
    'in_casa',
    'recovering',
    'battle_allowed',
  ],
};

/** `/state` — the account route body. */
const STATE_LEVEL: SchemaLevel = {
  keys: [
    'gold',
    'crystals',
    'phase',
    'max_phase',
    'locked',
    'checkpoint_at',
    'chests',
    'chest_stash',
    'item_stash',
    'vip_until',
    'bag_tabs',
    'bag_capacity',
    'items_count',
  ],
  allowance: ['account_id', 'player_name'],
};

/** `/roster` — the heroes route body: one wrapper key over the roster array. */
const ROSTER_LEVEL: SchemaLevel = {
  keys: ['heroes'],
  children: { heroes: { kind: 'array', element: SCHEMA_LEVELS.hero } },
};

/** `/rotation` — the casa route body. */
const ROTATION_LEVEL: SchemaLevel = {
  keys: ['field_size', 'heroes', 'casa', 'rescues_left', 'rescues_max'],
  children: {
    heroes: { kind: 'array', element: ROTATION_HERO_LEVEL },
    casa: { kind: 'object', level: SCHEMA_LEVELS.casa },
  },
};

/** `/inventory` — the items route body. */
const INVENTORY_LEVEL: SchemaLevel = {
  keys: ['items', 'chests', 'bag_tabs', 'bag_capacity', 'items_count'],
  children: { items: { kind: 'array', element: SCHEMA_LEVELS.item } },
};

export const ROUTE_FINGERPRINTS: Readonly<Record<AccountSection, RouteFingerprint>> = {
  account: {
    root: 'account',
    level: STATE_LEVEL,
    gameBuild: GAME_BUILD,
    capturedAt: CAPTURED_AT,
    sourceArtifact: SOURCE_ARTIFACT,
  },
  heroes: {
    root: 'heroes',
    level: ROSTER_LEVEL,
    gameBuild: GAME_BUILD,
    capturedAt: CAPTURED_AT,
    sourceArtifact: SOURCE_ARTIFACT,
  },
  skills: {
    root: 'skills',
    level: SCHEMA_LEVELS.skills,
    gameBuild: GAME_BUILD,
    capturedAt: CAPTURED_AT,
    sourceArtifact: SOURCE_ARTIFACT,
  },
  casa: {
    root: 'casa',
    level: ROTATION_LEVEL,
    gameBuild: GAME_BUILD,
    capturedAt: CAPTURED_AT,
    sourceArtifact: SOURCE_ARTIFACT,
  },
  items: {
    root: 'items',
    level: INVENTORY_LEVEL,
    gameBuild: GAME_BUILD,
    capturedAt: CAPTURED_AT,
    sourceArtifact: SOURCE_ARTIFACT,
  },
};

// --- Section fingerprints — the PROJECTED shapes (design §5.3) -------------------------------
//
// `ROUTE_FINGERPRINTS[section]` fingerprints the whole route BODY (what `checkShape` is handed
// at `routes.ts`). `SECTION_FINGERPRINTS[section]` fingerprints the PROJECTED body: what
// `persist` writes and `restore` reads — `heroes` -> array of `hero`, `items` -> array of `item`,
// `casa` -> `casa` (unwrapped from its `/rotation` route body), `account`/`skills` -> identical to
// their route levels (their routes project as identity). Needed because stored rows hold the
// PROJECTED shape, not the route body — apps/desktop's `AccountStore.restore()` (T10) checks
// against these, never against `ROUTE_FINGERPRINTS`.

/** A section fingerprint is either object-rooted (checked via `checkSchema` directly) or
 *  array-rooted (each element checked via `checkSchema`, indexed `root[i]…` — `heroes[3].in_market`,
 *  design §AD-087's own path example). Composed entirely from `@bombfarm/domain`'s exported
 *  primitives; no new schema-engine surface is added to `packages/domain`. */
export type SectionFingerprint =
  | ({ readonly kind: 'object' } & SchemaFingerprint)
  | {
      readonly kind: 'array';
      readonly root: string;
      readonly element: SchemaLevel;
      readonly gameBuild: string;
      readonly capturedAt: string;
      readonly sourceArtifact: string;
    };

export const SECTION_FINGERPRINTS: Readonly<Record<AccountSection, SectionFingerprint>> = {
  account: { kind: 'object', ...ROUTE_FINGERPRINTS.account },
  skills: { kind: 'object', ...ROUTE_FINGERPRINTS.skills },
  casa: {
    kind: 'object',
    root: 'casa',
    level: SCHEMA_LEVELS.casa,
    gameBuild: GAME_BUILD,
    capturedAt: CAPTURED_AT,
    sourceArtifact: SOURCE_ARTIFACT,
  },
  heroes: {
    kind: 'array',
    root: 'heroes',
    element: SCHEMA_LEVELS.hero,
    gameBuild: GAME_BUILD,
    capturedAt: CAPTURED_AT,
    sourceArtifact: SOURCE_ARTIFACT,
  },
  items: {
    kind: 'array',
    root: 'items',
    element: SCHEMA_LEVELS.item,
    gameBuild: GAME_BUILD,
    capturedAt: CAPTURED_AT,
    sourceArtifact: SOURCE_ARTIFACT,
  },
};

/**
 * Checks a PROJECTED section value against `SECTION_FINGERPRINTS[section]`. `object`-kind
 * delegates straight to `checkSchema`; `array`-kind checks every element (indexed `root[i]…`,
 * never `root.root[i]…`) and never passes vacuously on an empty array being "nothing to check" —
 * an empty array here IS a valid `ok:true` at runtime (an account can legitimately have zero
 * stored heroes mid-refresh); the anti-vacuity requirement (`MSG-06`) applies to the COMMITTED
 * CORPUS the suite checks against, not to every runtime value this function is handed.
 */
export function checkSectionShape(value: unknown, fingerprint: SectionFingerprint): ReturnType<typeof checkSchema> {
  if (fingerprint.kind === 'object') {
    return checkSchema(value, fingerprint);
  }

  const missingKeys: string[] = [];
  const addedKeys: string[] = [];
  if (!Array.isArray(value)) {
    missingKeys.push(fingerprint.root);
  } else {
    value.forEach((element, index) => {
      const perElement = checkSchema(element, {
        root: `${fingerprint.root}[${String(index)}]`,
        level: fingerprint.element,
        gameBuild: fingerprint.gameBuild,
        capturedAt: fingerprint.capturedAt,
        sourceArtifact: fingerprint.sourceArtifact,
      });
      if (!perElement.ok) {
        missingKeys.push(...perElement.missingKeys);
        addedKeys.push(...perElement.addedKeys);
      }
    });
  }

  if (missingKeys.length === 0 && addedKeys.length === 0) return { ok: true };
  return { ok: false, missingKeys, addedKeys };
}
