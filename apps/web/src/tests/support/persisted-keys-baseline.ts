/**
 * The exact `bf-hp-*` persisted key-string set on `origin/develop` at the Farm Ranking branch
 * cut — captured via
 * `git grep -n "'bf-hp-\|\"bf-hp-" origin/develop -- apps/web/src/shared/lib`.
 * The Farm Ranking feature itself was additive-only on existing keys and never added, removed,
 * or renamed one.
 *
 * `bf-hp-critdmg-flat-migrated-v1` (PR #90 review item 1) is a deliberate, later addition: the
 * one-shot marker gating `migrateCritDmgFlatBakeOnce` in `storage.ts` — see that function's own
 * docs for why an explicit persisted key, not a content heuristic, is required.
 */
export const PERSISTED_KEY_BASELINE = [
  'bf-hp-inventory-v1',
  'bf-hp-phases-view-v1',
  'bf-hp-heroes-v1',
  'bf-hp-account-v1',
  'bf-hp-active-hero-v1',
  'bf-hp-gear-scope-v1',
  'bf-hp-critdmg-flat-migrated-v1',
] as const;
