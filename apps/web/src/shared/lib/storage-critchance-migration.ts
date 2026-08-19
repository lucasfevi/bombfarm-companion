/**
 * One-shot flat-crit-chance / flat-CDR roster migration, split out of `storage.ts` to keep that
 * module under its size cap. Its only caller is `loadHeroes`. Directly parallel to
 * `storage-critdmg-migration.ts`, which did the same job for crit DAMAGE at the 2026-08-13
 * patch — this one covers crit CHANCE and COOLDOWN, which the 2026-08-15 patch moved to the
 * same flat shape.
 */
import { emptyLoadout, sumGearBonuses } from '@bombfarm/domain/gear';
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
 * bake to the flat-additive bake this change ships, and discards a `gearedOverride` whose crit
 * chance or CDR the patch invalidated.
 *
 * Before: `naked.critChance` was written as `rollTimesStar × (1 + 0.0075 × rank)`.
 * After:  `naked.critChance` must read as `rollTimesStar + 0.04574 × rank`.
 *
 * Recovers `rollTimesStar` by dividing out the record's OWN `abilities.olho_clinico` level — the
 * ability level that produced the stored value, never a live level from elsewhere, since this is
 * a per-record replay. At `rank = 0` both formulas agree, so that half is the identity for every
 * hero without the ability. `naked.cdr` needs no conversion at all: the game has no cooldown
 * ability, so the stored value was already `rollTimesStar` with no `other` factor to peel.
 *
 * **Two independent triggers, and the second is easy to miss.** The ability bake is only one of
 * the terms that changed shape — GEAR did too, for BOTH stats. A record with no Olho Clínico but
 * a cooldown or crit roll on its loadout still holds a `gearedOverride` computed as
 * `naked × (1 + Σ gear)` under the old shared pool, which the new model reads as `naked + Σ gear`.
 * Gating on the ability alone (the obvious reading of "this is the Olho Clínico migration") would
 * leave every such record stale forever, and cooldown gear is common — it is the single most
 * frequent roll on chest and pants after the 2026-08-16 redistribution.
 *
 * `gearedOverride` is DROPPED rather than converted. The old `Σ gear` cannot be recovered: the
 * 2026-08-15 catalog divided every crit and cooldown roll by ~55x and ~190x, so today's
 * `sumGearBonuses` returns the new term, not the one baked into the stored scalar, and the two
 * cannot be separated from a single stored number. `normalizeHero`'s `migrateGearedOverride`
 * rebuilds it as `applyGear(naked, loadout, sheetOther)` on the next read, which is exactly the
 * value the new model wants — see the note on the skill tree below.
 *
 * A record carrying `birth` is converted the same way for consistency, but its converted
 * `naked`/`gearedOverride` never reaches the pipeline: `resolveDeriveSheets`
 * (`packages/domain/src/advisor-pipeline-sheets.ts`) recomputes both from `birth` whenever
 * `birth` is present, so a birth-backed hero is unaffected either way.
 *
 * **On the skill tree.** The rebuild is `applyGear` alone, with no `applySkillTree`, so the
 * rebuilt sheet is tree-free. That matches what `migrateGearedOverride` has always produced and
 * what `storage-roundtrip.test.ts` pins, so it is the convention this store already uses.
 * `import-save.ts` disagrees — it writes `composeSheetFromBirth({ …, tree })`, which IS
 * tree-inclusive — but that mismatch predates this change and is tracked separately; a
 * birth-carrying import record is also exactly the case `resolveDeriveSheets` recomputes, so the
 * disagreement is unobservable for the records `import-save.ts` writes.
 */
function migrateCritChanceFlatBake(hero: Partial<HeroRecord>): Partial<HeroRecord> {
  const rank = Math.max(0, hero.abilities?.olho_clinico ?? 0);
  const gear = sumGearBonuses(hero.loadout ?? emptyLoadout());
  const gearedIsStale = hero.gearedOverride != null && (gear.critPct > 0 || gear.cdrPct > 0);
  if (rank <= 0 && !gearedIsStale) return hero;

  const oldFactor = 1 + (LEGACY_OLHO_PCT_OF_BASE_PER_RANK / 100) * rank;
  const newFlat = FLAT_OLHO_PP_PER_RANK * rank;

  const naked =
    hero.naked &&
    typeof hero.naked.critChance === 'number' &&
    Number.isFinite(hero.naked.critChance)
      ? { ...hero.naked, critChance: hero.naked.critChance / oldFactor + newFlat }
      : hero.naked;

  // Reaching here means the ability bake changed (`rank > 0`), the gear term changed
  // (`gearedIsStale`), or both — in every one of those cases the stored geared sheet is stale, so
  // it is shed unconditionally. A rank-0 record with no crit/cooldown gear returned above with
  // its sheet intact, which is what keeps this a no-op for the records that are still correct.
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
