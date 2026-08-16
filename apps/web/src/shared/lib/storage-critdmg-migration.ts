/**
 * One-shot flat-crit-damage roster migration, split out of `storage.ts` to keep that module
 * under its size cap. Its only caller is `loadHeroes`.
 */
import type { HeroRecord } from './storage';
import { readJson, writeJson } from './storage-json';

/**
 * One-shot marker (schema-version-bump idiom, same precedent as the `bf-pa-heroes-v2`/`v1` →
 * `bf-hp-heroes-v1` migration below) gating {@link migrateCritDmgFlatBakeOnce}. Never
 * repurposed, never removed — its only job is "has this browser's roster already been walked
 * for the flat-crit-damage conversion", and a content heuristic cannot answer that (a rank-0
 * Golpe Brutal record and an already-migrated one are byte-identical).
 */
const CRIT_DMG_FLAT_MIGRATED_KEY = 'bf-hp-critdmg-flat-migrated-v1';

/**
 * Converts ONE legacy record's `naked.critDmg` (and `gearedOverride.critDmg`, which always
 * equals it pre-migration — gear never rolls crit damage, see `gear/apply.ts`) from the
 * pre-fix multiplicative Golpe Brutal bake to the flat-additive bake this fix ships
 * (`.changeset/crit-damage-is-flat.md`).
 *
 * Before: `naked.critDmg` was written as `rollTimesStar × (1 + 0.04 × rank)`.
 * After:  `naked.critDmg` must read as `rollTimesStar + 4 × rank`.
 *
 * Recovers `rollTimesStar = legacy / (1 + 0.04 × rank)`, using the record's OWN
 * `abilities.golpe_brutal` level as `rank` (the ability level that produced the stored value —
 * never the ability's live/current level from elsewhere, since this is a per-record replay).
 * At `rank = 0` both formulas agree (`legacy / 1 + 0 = legacy`), so this is the identity for
 * every hero without the ability — the overwhelming majority of records.
 *
 * A record carrying `birth` is converted the same way for consistency, but its converted
 * `naked`/`gearedOverride` never actually reaches the pipeline: `resolveDeriveSheets`
 * (`advisor-pipeline-sheets.ts`) recomputes both from `birth` whenever `birth` is present, so a
 * birth-backed hero's on-screen behavior is unaffected either way.
 */
function migrateCritDmgFlatBake(hero: Partial<HeroRecord>): Partial<HeroRecord> {
  const rank = Math.max(0, hero.abilities?.golpe_brutal ?? 0);
  if (rank <= 0) return hero;

  const oldFactor = 1 + 0.04 * rank;
  const newFlat = 4 * rank;
  const convert = (legacy: number): number => legacy / oldFactor + newFlat;

  const naked =
    hero.naked && typeof hero.naked.critDmg === 'number' && Number.isFinite(hero.naked.critDmg)
      ? { ...hero.naked, critDmg: convert(hero.naked.critDmg) }
      : hero.naked;
  const gearedOverride =
    hero.gearedOverride &&
    typeof hero.gearedOverride.critDmg === 'number' &&
    Number.isFinite(hero.gearedOverride.critDmg)
      ? { ...hero.gearedOverride, critDmg: convert(hero.gearedOverride.critDmg) }
      : hero.gearedOverride;

  return { ...hero, naked, gearedOverride };
}

/**
 * Walks the WHOLE roster through {@link migrateCritDmgFlatBake} exactly once per browser
 * profile, gated by `CRIT_DMG_FLAT_MIGRATED_KEY` so a second `loadHeroes()` call (this session
 * or a future one) can never re-apply the conversion to an already-migrated value — doing so
 * would silently corrupt it a second time.
 *
 * The marker itself is written UNCONDITIONALLY the first time it is absent, even when nothing
 * in the CURRENT roster needed converting (empty roster, or every record at Golpe Brutal rank
 * 0) — this is deliberate, not a missed optimization: the marker's soundness depends on
 * covering the roster as it stood the FIRST time this code ever ran, not on whatever happens to
 * need conversion today. Every record present in local storage at that first run is guaranteed
 * to predate this fix (the flat model did not exist before it), so blanket-covering that
 * snapshot is safe; deferring the marker write until "something actually changed" would leave
 * it unset for a store with zero Golpe Brutal heroes today, and a LATER hero freshly computed
 * under the (already-correct) flat model would then be wrongly re-interpreted as legacy on the
 * next boot — exactly the content-heuristic failure mode this marker exists to avoid.
 *
 * `changed` is reported separately (reference-identity per record) purely so the caller can
 * skip an otherwise-pointless `saveHeroes` rewrite when every conversion was a no-op — the
 * marker write is the only storage effect a genuinely clean roster incurs.
 */
export function migrateCritDmgFlatBakeOnce(
  list: Partial<HeroRecord>[],
): { list: Partial<HeroRecord>[]; changed: boolean } {
  if (readJson<boolean>(CRIT_DMG_FLAT_MIGRATED_KEY, false)) {
    return { list, changed: false };
  }
  let changed = false;
  const migrated = list.map((hero) => {
    const next = migrateCritDmgFlatBake(hero);
    if (next !== hero) changed = true;
    return next;
  });
  writeJson(CRIT_DMG_FLAT_MIGRATED_KEY, true);
  return { list: migrated, changed };
}
