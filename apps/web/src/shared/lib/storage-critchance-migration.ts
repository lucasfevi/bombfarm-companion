/**
 * One-shot flat-crit-chance roster migration, split out of `storage.ts` to keep that module
 * under its size cap. Its only caller is `loadHeroes`. Directly parallel to
 * `storage-critdmg-migration.ts`, which did the same job for crit DAMAGE at the 2026-08-13
 * patch — this one covers crit CHANCE, which the 2026-08-15 patch moved to the same flat shape.
 */
import type { HeroRecord } from './storage';
import { readJson, writeJson } from './storage-json';

/**
 * One-shot marker, same schema-version-bump idiom as `bf-hp-critdmg-flat-migrated-v1`. Never
 * repurposed, never removed — its only job is "has this browser's roster already been walked for
 * the flat-crit-chance conversion", and a content heuristic cannot answer that (an Olho Clínico
 * rank-0 record and an already-migrated one are byte-identical).
 */
const CRIT_CHANCE_FLAT_MIGRATED_KEY = 'bf-hp-critchance-flat-migrated-v1';

/** The pre-patch Olho Clínico rate: 0.75% OF THE ROLL per rank. */
const LEGACY_OLHO_PCT_OF_BASE_PER_RANK = 0.75;
/** The post-patch rate: a FLAT 0.04574 planner percentage points per rank. */
const FLAT_OLHO_PP_PER_RANK = 0.04574;

/**
 * Converts ONE legacy record's `naked.critChance` from the pre-patch multiplicative Olho Clínico
 * bake to the flat-additive bake this change ships.
 *
 * Before: `naked.critChance` was written as `rollTimesStar × (1 + 0.0075 × rank)`.
 * After:  `naked.critChance` must read as `rollTimesStar + 0.04574 × rank`.
 *
 * Recovers `rollTimesStar` by dividing out the record's OWN `abilities.olho_clinico` level — the
 * ability level that produced the stored value, never a live level from elsewhere, since this is
 * a per-record replay. At `rank = 0` both formulas agree, so this is the identity for every hero
 * without the ability.
 *
 * `gearedOverride.critChance` is converted too, but NOT by the same expression: unlike crit
 * damage (which gear never rolls), gear DOES roll crit chance, so the geared value carries an
 * item term on top of the ability bake. Under the old model that term was inside the same
 * multiplicative pool; under the new one it is a flat addend. Recovering the split from the
 * stored scalar alone is not possible, so `gearedOverride` is dropped for affected records
 * instead of being converted wrongly — `resolveDeriveSheets` recomputes it from `naked` + the
 * record's own loadout on the next read, which is exactly the value the new model wants.
 *
 * A record carrying `birth` is converted the same way for consistency, but its converted
 * `naked`/`gearedOverride` never reaches the pipeline: `resolveDeriveSheets` recomputes both
 * from `birth` whenever `birth` is present, so a birth-backed hero is unaffected either way.
 */
function migrateCritChanceFlatBake(hero: Partial<HeroRecord>): Partial<HeroRecord> {
  const rank = Math.max(0, hero.abilities?.olho_clinico ?? 0);
  if (rank <= 0) return hero;

  const oldFactor = 1 + (LEGACY_OLHO_PCT_OF_BASE_PER_RANK / 100) * rank;
  const newFlat = FLAT_OLHO_PP_PER_RANK * rank;

  const naked =
    hero.naked &&
    typeof hero.naked.critChance === 'number' &&
    Number.isFinite(hero.naked.critChance)
      ? { ...hero.naked, critChance: hero.naked.critChance / oldFactor + newFlat }
      : hero.naked;

  // Deliberately dropped, not converted — see the doc comment above.
  const { gearedOverride: _dropped, ...rest } = hero;
  return { ...rest, naked };
}

/**
 * Walks the WHOLE roster through {@link migrateCritChanceFlatBake} exactly once per browser
 * profile, gated by `CRIT_CHANCE_FLAT_MIGRATED_KEY` so a second `loadHeroes()` call can never
 * re-apply the conversion to an already-migrated value.
 *
 * The marker is written UNCONDITIONALLY the first time it is absent, even when nothing in the
 * current roster needed converting — the same reasoning the crit-damage migration records: the
 * marker's soundness depends on covering the roster as it stood the FIRST time this code ran,
 * and deferring the write would let a later, already-correct record be re-interpreted as legacy
 * on a future boot.
 */
export function migrateCritChanceFlatBakeOnce(
  list: Partial<HeroRecord>[],
): { list: Partial<HeroRecord>[]; changed: boolean } {
  if (readJson<boolean>(CRIT_CHANCE_FLAT_MIGRATED_KEY, false)) {
    return { list, changed: false };
  }
  let changed = false;
  const migrated = list.map((hero) => {
    const next = migrateCritChanceFlatBake(hero);
    if (next !== hero) changed = true;
    return next;
  });
  writeJson(CRIT_CHANCE_FLAT_MIGRATED_KEY, true);
  return { list: migrated, changed };
}
