/**
 * One-shot roster migration for the 2026-08-18 patch, split out of `storage.ts` to keep that
 * module under its size cap. Its only caller is `loadHeroes`. Directly parallel to
 * `storage-critchance-migration.ts`, which did the same job in the OPPOSITE direction for the
 * 2026-08-15 patch — that patch moved crit chance and cooldown from percent-of-base to flat,
 * this one moves them back to percent-of-base three days later.
 */
import { emptyLoadout, sumGearBonuses } from '@bombfarm/domain/gear';
import type { HeroRecord } from './storage';
import { readJson, writeJson } from './storage-json';

/**
 * One-shot marker, same schema-version-bump idiom as `bf-hp-critchance-flat-migrated-v1`. Never
 * repurposed, never removed — its only job is "has this browser's roster already been walked for
 * the crit/CDR re-pool conversion", and a content heuristic cannot answer that (an Olho Clínico
 * rank-0 record and an already-migrated one are byte-identical).
 */
const CRIT_CDR_REPOOL_MIGRATED_KEY = 'bf-hp-critcdr-repool-migrated-v1';

/** The 2026-08-15..18 flat rate: a FLAT 0.04574 planner percentage points per rank. */
const FLAT_OLHO_PP_PER_RANK = 0.04574;
/** The 2026-08-18 rate: 4.285714285714286% OF THE ROLL per rank (0.75 × 40/7, see abilities.ts). */
const REPOOLED_OLHO_PCT_OF_BASE_PER_RANK = 4.285714285714286;

/**
 * Converts ONE legacy record's `naked.critChance` from the 2026-08-15..18 flat-additive Olho
 * Clínico bake back to the percent-of-base bake the 2026-08-18 patch restored, and discards a
 * `gearedOverride` whose crit chance or CDR the patch invalidated.
 *
 * Before: `naked.critChance` was written as `rollTimesStar + 0.04574 × rank`.
 * After:  `naked.critChance` must read as `rollTimesStar × (1 + 0.04285714285714286 × rank)`.
 *
 * Recovers `rollTimesStar` by subtracting the record's OWN `abilities.olho_clinico` level's flat
 * contribution — the ability level that produced the stored value, never a live level from
 * elsewhere, since this is a per-record replay. At `rank = 0` both formulas agree, so that half
 * is the identity for every hero without the ability. `naked.cdr` needs no conversion at all:
 * the game has no cooldown ability, so the stored value has never carried an `other` term to
 * peel or reintroduce, in either regime.
 *
 * **Two independent triggers, and the second is easy to miss** — same shape as the migration
 * this one reverses. The ability bake is only one of the terms that changed shape — GEAR did
 * too, for BOTH stats: `sumGearBonuses` no longer converts crit/cooldown rolls to flat planner
 * percentage points, so a record with no Olho Clínico but a cooldown or crit roll on its loadout
 * still holds a `gearedOverride` computed as `naked + Σ gear` under the flat regime, which the
 * repooled model reads as `naked × (1 + Σ gear)`. Gating on the ability alone would leave every
 * such record stale forever.
 *
 * `gearedOverride` is DROPPED rather than converted, for the same reason the migration this one
 * reverses drops it: the two shapes cannot be separated from a single stored number.
 * `normalizeHero`'s `migrateGearedOverride` rebuilds it as `applyGear(naked, loadout, sheetOther)`
 * on the next read, which is exactly the value the repooled model wants.
 *
 * A record carrying `birth` is converted the same way for consistency, but its converted
 * `naked`/`gearedOverride` never reaches the pipeline: `resolveDeriveSheets`
 * (`packages/domain/src/advisor-pipeline-sheets.ts`) recomputes both from `birth` whenever
 * `birth` is present, so a birth-backed hero is unaffected either way.
 */
function migrateCritCdrRepoolBake(hero: Partial<HeroRecord>): Partial<HeroRecord> {
  const rank = Math.max(0, hero.abilities?.olho_clinico ?? 0);
  const gear = sumGearBonuses(hero.loadout ?? emptyLoadout());
  const gearedIsStale = hero.gearedOverride != null && (gear.critPct > 0 || gear.cdrPct > 0);
  if (rank <= 0 && !gearedIsStale) return hero;

  const oldFlat = FLAT_OLHO_PP_PER_RANK * rank;
  const newFactor = 1 + (REPOOLED_OLHO_PCT_OF_BASE_PER_RANK / 100) * rank;

  const naked =
    hero.naked &&
    typeof hero.naked.critChance === 'number' &&
    Number.isFinite(hero.naked.critChance)
      ? { ...hero.naked, critChance: (hero.naked.critChance - oldFlat) * newFactor }
      : hero.naked;

  // Reaching here means the ability bake changed (`rank > 0`), the gear term changed
  // (`gearedIsStale`), or both — in every one of those cases the stored geared sheet is stale, so
  // it is shed unconditionally. A rank-0 record with no crit/cooldown gear returned above with
  // its sheet intact, which is what keeps this a no-op for the records that are still correct.
  const { gearedOverride: _dropped, ...rest } = hero;
  return { ...rest, naked };
}

/**
 * Walks the WHOLE roster through {@link migrateCritCdrRepoolBake} exactly once per browser
 * profile, gated by `CRIT_CDR_REPOOL_MIGRATED_KEY` so a second `loadHeroes()` call can never
 * re-apply the conversion to an already-migrated value.
 *
 * The marker is written UNCONDITIONALLY the first time it is absent, even when nothing in the
 * current roster needed converting — the same reasoning the other two flat-bake migrations
 * record: the marker's soundness depends on covering the roster as it stood the FIRST time this
 * code ran, and deferring the write would let a later, already-correct record be re-interpreted
 * as legacy on a future boot.
 */
export function migrateCritCdrRepoolBakeOnce(
  list: Partial<HeroRecord>[],
): { list: Partial<HeroRecord>[]; changed: boolean } {
  if (readJson<boolean>(CRIT_CDR_REPOOL_MIGRATED_KEY, false)) {
    return { list, changed: false };
  }
  let changed = false;
  const migrated = list.map((hero) => {
    const next = migrateCritCdrRepoolBake(hero);
    if (next !== hero) changed = true;
    return next;
  });
  writeJson(CRIT_CDR_REPOOL_MIGRATED_KEY, true);
  return { list: migrated, changed };
}
