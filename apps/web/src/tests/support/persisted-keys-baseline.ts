/**
 * The exact `bf-hp-*` persisted key-string set on `origin/develop` at the Farm Ranking branch
 * cut — captured via
 * `git grep -n "'bf-hp-\|\"bf-hp-" origin/develop -- apps/web/src/shared/lib`.
 * This feature is additive-only on existing keys; it must never add, remove or rename one.
 */
export const PERSISTED_KEY_BASELINE = [
  'bf-hp-inventory-v1',
  'bf-hp-phases-view-v1',
  'bf-hp-heroes-v1',
  'bf-hp-account-v1',
  'bf-hp-active-hero-v1',
  'bf-hp-gear-scope-v1',
] as const;
