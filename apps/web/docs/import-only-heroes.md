# Import-only heroes

**Status:** hard truth  

## Policy

1. **Every hero in the planner must come from a BombFarm save import.** There is no roster entry without a save `sourceId`, and no full ability catalog for heroes outside their export pool.
2. **`sourceId` (save export hero id) is required.** A `HeroRecord` without a non-empty `sourceId` is invalid and must not appear in the roster.
3. **Breaking change (accepted):** On load, heroes missing `sourceId` are **dropped** from `localStorage` and never shown. Users with only invalid entries see the empty import workspace until they import a save.
4. **Abilities are the hero’s fixed pool** from the save export (including **level 0** slots). UI shows only those abilities — never all 16 catalog entries.

## Storage

- **`loadHeroes()`** filters to `sourceId` present, persists the filtered list when anything was removed, and re-points the active hero if it was dropped.
- **`importHeroes()`** is the only way to add heroes. Do not add UI or APIs to create heroes without `sourceId`.
- **`upsertHero()`** persists edits to an **existing** imported hero (same local `id`); it is not a create-from-scratch path for new rosters.

## UI / copy

- Empty workspace copy stays **import-only** ([`emptyTitle` / `emptyBody`](../src/shared/i18n)).
- Ability panel, roster icons, and picker rows use [`hero-abilities.ts`](../../../packages/domain/src/hero-abilities.ts) — pool keys only.

## Tests

- Prove `loadHeroes` drops heroes without `sourceId` and fixes active id.
- Ability helpers assume a fixed pool only.

## Related

- [`local-data-compat.md`](local-data-compat.md) — `sourceId` + ability pool on `-v1` schema; re-import merge rules unchanged
