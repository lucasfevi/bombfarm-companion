/**
 * The `AccountShared` concern of `@/shared/lib/storage` — `TreeState`/`HeroContext`/
 * `AccountShared` themselves, their defaults, and their load-time normalizers — split out to
 * keep `storage.ts` under the shared-lib `max-lines` cap. `storage.ts` sat at its file-specific
 * allowlist cap with zero slack after four straight waves of "bump the cap, not this wave's
 * scope to split"; this wave finally splits it instead of bumping a fifth time. Extracting
 * `TreeState`/`DEFAULT_TREE`/`normalizeTree` alone (its immediate persisted-field growth) was
 * not enough slack on its own to clear the default 300-line cap without a bump, so its two
 * siblings under the same `AccountShared` envelope — `HeroContext` and `AccountShared` itself,
 * with their own defaults/normalizers — moved out alongside it as one cohesive "account-shared
 * state" concern, distinct from the `HeroRecord` persistence concern `storage.ts` keeps.
 *
 * `loadAccountShared`/`saveAccountShared` (the actual localStorage I/O) stay in `storage.ts` —
 * they need `HeroRecord` for the legacy per-hero-donor migration path, so moving them here would
 * just trade one cross-module dependency for its reverse. `storage.ts` re-exports every symbol
 * below so existing import paths and persistence bytes stay exactly as they were.
 */
import { DEFAULT_CASA_SLOTS } from '@bombfarm/domain/casa-slots';
import { FORJA_MAX } from '@bombfarm/domain/gear';
import type { RankMode } from '@bombfarm/domain/model';
import {
  toRequiredAccountFields,
  type RequiredAccountField,
} from '@bombfarm/domain/account-required-fields';
import { DEFAULT_TARGET_PROP } from '@bombfarm/domain/farm-context';

export type TreeState = {
  /** Squad damage × from the tree UI — already includes GEO / compound / keystone damage mults. */
  danoTotal: number;
  critChance: number;
  /** Crit damage bonus as % of base roll (g_crit_dmg). */
  critDmg: number;
  speed: number;
  energy: number;
  /** Account-wide team_coin total as % (Ouro por Alvo nodes) — scales gold per prop. */
  teamCoinPct: number;
  /**
   * Flat Luck percentage points from `skills.totals.luck_add × 100`.
   * Additive on `bf-hp-account-v1` — optional (not `number`) so pre-Wave-5 literals (e.g.
   * `e2e/fixtures/seed.ts`, out of this wave's touch scope) keep typechecking; every read
   * site defaults absence to `0` and `normalizeTree`'s rebuild fills it on load. Import-sourced
   * only; no Account UI field yet (CARRY-05).
   */
  luckFlatPct?: number;
  /**
   * `skills.totals.xp_mult` verbatim (not a percentage) — scales XP per prop the same way
   * `teamCoinPct` scales gold per prop. Optional, same precedent as {@link luckFlatPct}: so
   * pre-existing literals (e.g. `e2e/fixtures/seed.ts`) keep typechecking; every read site
   * defaults absence to `1` (NOT `0` — a `?? 0` here would silently zero every XP figure) and
   * `normalizeTree`'s rebuild fills it on load.
   */
  xpMult?: number;
  /**
   * `team_dmg_add × 100` and `geo_mult` — the two factors {@link danoTotal} is the product of
   * (verified to full double precision on two captures). DISPLAY ONLY: every damage computation
   * still reads `danoTotal`, which is the value the game client itself counts with. Optional for
   * the same reason {@link luckFlatPct} is — pre-existing persisted records and test literals
   * predate them, and the Account page renders a dash when they are absent.
   */
  squadDmgPct?: number;
  geoMult?: number;
  /** `vagas_campo` — field slots the TREE grants; `skills.field_slots` is always this plus one. */
  fieldSlotsBonus?: number;
  /** `bag_tabs_bonus` — extra bag tabs the tree grants. */
  bagTabsBonus?: number;
};

export type HeroContext = {
  houseIdx: number;
  houseLevel: number;
  /** Synced from Phases via “Use as farm phase”; null until set. DPS uses phase 1 when null. */
  phase: number | null;
  mitigationPct: number;
  rankMode: RankMode;
  /** Highlighted row in the prop hits-to-kill table — null until set on Account. */
  targetProp: string | null;
  /** @deprecated always serial — ignored on load. */
  cycleModel?: 'serial' | 'wiki';
  /** @deprecated use {@link FARM_WALK_DELAY_SEC} — ignored on load. */
  walkDelay?: number;
  /** @deprecated dropped — ignored on load. */
  extraDmgPct?: number;
};

/** Shared across every hero on this browser (tree, team buffs, farming context). */
export type AccountShared = {
  tree: TreeState;
  /**
   * @deprecated superseded by {@link teamBuffsOverride} (issue #132) — the roster-wide total is
   * now DERIVED from the deployed roster by default, not stored here. Kept, and still written
   * on save, only so an old app build reading a fresh file sees SOMETHING plausible (the current
   * override, or `{}` when there is none) instead of a missing field; no current code reads it
   * for the override decision.
   */
  teamBuffs: Record<string, number>;
  /**
   * The user's explicit team-buffs OVERRIDE — `null`/absent means "derive from the deployed
   * roster" (`computeTeamBuffsFromDeployed`, `@bombfarm/domain/team-buffs`), the default for a
   * fresh import and for every account that has never touched the Account panel's team-buff
   * fields. A hero carrying a team aura otherwise got ZERO benefit from it until a user found
   * the auto-fill button — that was the actual regression this field exists to close, not
   * "0 means unset": the Reset button still writes an EXPLICIT all-zero override
   * (`zeroTeamBuffs()`), which stays a genuine "model this roster with no team auras at all"
   * choice, distinguishable from never having touched the panel.
   */
  teamBuffsOverride?: Record<string, number> | null;
  context: HeroContext;
  /**
   * HOUSE RECOVERY slots (`casa.slots`) — how many heroes the House refills at a time. Defaults
   * to {@link DEFAULT_CASA_SLOTS} when absent on load. NOT the field concurrency cap: that is
   * {@link fieldSlots}, and the two are different numbers on a real save.
   */
  slots?: number;
  /**
   * FIELD slots (`skills.field_slots`) — how many heroes may be deployed at once. `null` on a
   * record persisted before the split (and on any account whose save carried no
   * `skills.field_slots`), which sends readers back to {@link slots} — the value they used to
   * read for this, wrongly, and still the only number such a record carries.
   */
  fieldSlots?: number | null;
  /**
   * `casa.cycle_secs` — full 0 → 100% House fill, seconds. `null` falls back to the `HOUSES`
   * table interpolation. Written by import alongside `slots`.
   */
  houseCycleSecs?: number | null;
  /**
   * The (house, level) `houseCycleSecs` above was captured at — the import's own `houseIdx`/
   * `houseLevel` at the moment it set `houseCycleSecs`, NOT the live picker (`context.houseIdx`/
   * `houseLevel`), which the House/House-level pickers can move independently afterward.
   * `resolveHouseRestSeconds` trusts `houseCycleSecs` only when the picker's current house/level
   * still equal these — otherwise the House-ceiling regression is back: a picker move stops
   * changing every computed number because the frozen save figure keeps winning regardless of
   * what house/level is actually requested.
   */
  houseCycleSecsHouseIdx?: number | null;
  houseCycleSecsLevel?: number | null;
  /** Optimizer forge floor — defaults to `10` when absent; import never overwrites. */
  forgeFloor?: number;
  /**
   * `account.max_phase` — furthest phase reached. Mirrors `@bombfarm/domain`'s
   * `AccountImportData.maxPhase: number | null` (dual-source, total). `null`/absent means no
   * lock badges anywhere and the Farm Ranking unlocked-only filter renders non-applicable.
   * Written UNCONDITIONALLY by `applyAccountImport` — unlike every sibling field
   * on this type, a re-import carrying no `max_phase` clears a stale value rather than keeping
   * it, because a stale lock badge would assert progress the payload just contradicted.
   */
  maxPhase?: number | null;
  /**
   * `account.player_name` / `account.account_id` — who the imported save belongs to, shown as
   * the Account page's header. `null`/absent whenever the save carried neither (they are
   * optional export keys), which renders as "no account imported" rather than a blank name.
   */
  playerName?: string | null;
  accountId?: string | null;
  /**
   * The `REQUIRED_ACCOUNT_FIELDS` the last import did not carry. Three states, not
   * interchangeable: absent/`null` is "no import has been checked against this rule" (a fresh
   * browser, or a record stored before it existed), `[]` is "imported and complete", non-empty
   * is what the banner names. A pre-rule record is deliberately NOT migrated to `[]` — it may
   * hold a `null` the rule would flag, and it must keep working until the user re-imports.
   */
  missingRequiredFields?: readonly RequiredAccountField[] | null;
};

export const DEFAULT_TREE = (): TreeState => ({
  danoTotal: 1,
  critChance: 0,
  critDmg: 0,
  speed: 0,
  energy: 0,
  teamCoinPct: 0,
  luckFlatPct: 0,
  xpMult: 1,
  squadDmgPct: 0,
  geoMult: 1,
  fieldSlotsBonus: 0,
  bagTabsBonus: 0,
});

export const DEFAULT_CONTEXT = (): HeroContext => ({
  houseIdx: 0,
  houseLevel: 0,
  phase: null,
  mitigationPct: 1,
  rankMode: 'farm',
  targetProp: DEFAULT_TARGET_PROP,
});

export const DEFAULT_ACCOUNT = (): AccountShared => ({
  tree: DEFAULT_TREE(),
  teamBuffs: {},
  teamBuffsOverride: null,
  context: DEFAULT_CONTEXT(),
});

/**
 * Fixed-field-list rebuild (the `normalizeHero`/`obsHit`/`obsCrit` pattern) — every field is
 * named explicitly, so any stale/unknown key on `raw` (a pre-change record's `glassCannon`,
 * `tempoDobrado`, `abisso`, `abissoBase`, `critDmgMult`, or the older `geo`) is silently
 * discarded rather than spread through. This matters: a spread merge (`{ ...base,
 * ...rest }`) would let those keys leak into the result even after they left `TreeState`.
 */
function normalizeTree(raw?: Partial<TreeState> | null): TreeState {
  const base = DEFAULT_TREE();
  if (!raw) return base;
  return {
    danoTotal: raw.danoTotal ?? base.danoTotal,
    critChance: raw.critChance ?? base.critChance,
    critDmg: raw.critDmg ?? base.critDmg,
    speed: raw.speed ?? base.speed,
    energy: raw.energy ?? base.energy,
    teamCoinPct: raw.teamCoinPct ?? base.teamCoinPct,
    luckFlatPct: raw.luckFlatPct ?? base.luckFlatPct,
    xpMult: raw.xpMult ?? base.xpMult,
    squadDmgPct: raw.squadDmgPct ?? base.squadDmgPct,
    geoMult: raw.geoMult ?? base.geoMult,
    fieldSlotsBonus: raw.fieldSlotsBonus ?? base.fieldSlotsBonus,
    bagTabsBonus: raw.bagTabsBonus ?? base.bagTabsBonus,
  };
}

/** A non-empty trimmed string, else `null` — a blank name is an absent name, not a label. */
function normalizeIdentityText(raw?: string | null): string | null {
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null;
}

/**
 * `'dps'` is a deliberate past choice and is respected. EVERYTHING else — absent, the retired
 * `'oneshot'` value, a hand-edited junk string, a number, null — resolves to the `'farm'`
 * default. Total by construction: there is no input for which this throws or returns a
 * non-RankMode. An allow-list rather than `raw.rankMode ?? 'farm'`, deliberately: a `??` default
 * only catches `null`/`undefined` and would let an unpredicted junk value straight through.
 */
function normalizeRankMode(raw: unknown): RankMode {
  return raw === 'dps' ? 'dps' : 'farm';
}

function normalizeContext(raw?: Partial<HeroContext> | null): HeroContext {
  const base = DEFAULT_CONTEXT();
  if (!raw) return base;
  const phase =
    raw.phase == null || raw.phase <= 0
      ? null
      : Math.max(1, Math.min(600, Math.round(raw.phase)));
  const targetProp =
    raw.targetProp == null || raw.targetProp === ''
      ? base.targetProp
      : raw.targetProp;
  return {
    houseIdx: raw.houseIdx ?? base.houseIdx,
    houseLevel: raw.houseLevel ?? base.houseLevel,
    phase,
    mitigationPct: raw.mitigationPct ?? base.mitigationPct,
    rankMode: normalizeRankMode(raw.rankMode),
    targetProp,
  };
}

function normalizeForgeFloor(raw?: number): number {
  const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : 10;
  return Math.max(0, Math.min(FORJA_MAX, Math.round(value)));
}

function normalizeSlots(raw?: number): number {
  const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : DEFAULT_CASA_SLOTS;
  return Math.max(1, Math.round(value));
}

/**
 * `null` when absent or unusable — the same "one inhabitant for known-absent" shape as
 * `normalizeMaxPhase` below, and deliberately NOT `normalizeSlots`'s substitute-a-default shape:
 * a reader must be able to tell "this save carries no field-slot count" from "this save says 9",
 * because the fallback for the former is `slots`, not the Casa default.
 */
function normalizeFieldSlots(raw?: number | null): number | null {
  if (raw == null || !Number.isFinite(raw) || raw < 1) return null;
  return Math.max(1, Math.round(raw));
}

/** `null` when absent or non-positive — absence means "use the `HOUSES` table". */
function normalizeHouseCycleSecs(raw?: number | null): number | null {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

/**
 * `null` when absent or non-finite — same "one inhabitant for known-absent" shape as
 * {@link normalizeMaxPhase}. No range clamp: this is an ANCHOR (the house/level `houseCycleSecs`
 * was captured at), not a live picker value, so it only ever needs to compare equal to one.
 */
function normalizeHouseCycleAnchor(raw?: number | null): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  return Math.round(raw);
}

/**
 * `null` when absent or non-finite (`@bombfarm/domain`'s reader is total, `number | null`; one
 * inhabitant for "known-absent" the whole way through), else integer-clamped `1..600` — the
 * same template as `normalizeContext`'s `phase` clamp.
 */
function normalizeMaxPhase(raw?: number | null): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  return Math.max(1, Math.min(600, Math.round(raw)));
}

/**
 * Migrates a persisted record to the override-or-derived shape (issue #132). A record already
 * written by this code carries `teamBuffsOverride` (possibly `null`) — trusted as-is. An older
 * record carries only the legacy `teamBuffs`, which was the ubiquitous, never-updated `{}` /
 * all-zero default for every account that had not pressed the auto-fill button — indistinguishable
 * from "never touched", so it migrates to `null` (derive from the roster) rather than freezing
 * that default as a permanent all-zero override. A legacy value with any genuinely nonzero entry
 * WAS a real auto-fill snapshot or hand edit, so it carries forward as an explicit override.
 *
 * STILL HONOURED even though the Account page's team-buff fields are gone: `farm-rate`'s
 * `priceTeamBuffs` branches on this field, and it stays the supported way for a caller to say
 * "assume this much aura" without a carrier attribution to weight. Dropping stored overrides
 * would silently move the Farm board for accounts that set one — a maintainer call, not a
 * side effect of removing a panel.
 */
function normalizeTeamBuffsOverride(raw?: Partial<AccountShared> | null): Record<string, number> | null {
  if (raw && 'teamBuffsOverride' in raw) {
    return raw.teamBuffsOverride ?? null;
  }
  const legacy = raw?.teamBuffs;
  if (!legacy) return null;
  const hasNonZero = Object.values(legacy).some((value) => typeof value === 'number' && value !== 0);
  return hasNonZero ? { ...legacy } : null;
}

export function normalizeAccount(raw?: Partial<AccountShared> | null): AccountShared {
  const missing = toRequiredAccountFields(raw?.missingRequiredFields);
  return {
    tree: normalizeTree(raw?.tree),
    teamBuffs: raw?.teamBuffs ?? {},
    teamBuffsOverride: normalizeTeamBuffsOverride(raw),
    context: normalizeContext(raw?.context),
    slots: normalizeSlots(raw?.slots),
    fieldSlots: normalizeFieldSlots(raw?.fieldSlots),
    houseCycleSecs: normalizeHouseCycleSecs(raw?.houseCycleSecs),
    houseCycleSecsHouseIdx: normalizeHouseCycleAnchor(raw?.houseCycleSecsHouseIdx),
    houseCycleSecsLevel: normalizeHouseCycleAnchor(raw?.houseCycleSecsLevel),
    forgeFloor: normalizeForgeFloor(raw?.forgeFloor),
    maxPhase: normalizeMaxPhase(raw?.maxPhase),
    playerName: normalizeIdentityText(raw?.playerName),
    accountId: normalizeIdentityText(raw?.accountId),
    // Omitted rather than `null` when absent on `raw` — see `selectAccountShared`.
    ...(missing != null ? { missingRequiredFields: missing } : {}),
  };
}
