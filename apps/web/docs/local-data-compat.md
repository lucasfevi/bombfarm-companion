# Local data compatibility (public users)

**Status:** hard truth  
**Sources:** public-release readiness review (2026-07-23); patterns in [`src/shared/lib/storage.ts`](../src/shared/lib/storage.ts)

Browser `localStorage` is the only user persistence. After public release, updates must be seamless for existing saves.

Canonical keys (current):

| Key | Payload |
| --- | --- |
| `bf-hp-heroes-v1` | `HeroRecord[]` |
| `bf-hp-active-hero-v1` | active hero id |
| `bf-hp-account-v1` | `AccountShared` (tree, team buffs, context) |

UI chrome prefs (`bf_lang`, guide/roster open state, etc.) are separate and must tolerate absence.

**Out of scope for this hard truth:** pre-public / private-only shapes (e.g. old point-advisor `bf-pa-*` keys). The product guarantee starts at the public `bf-hp-*-v1` schema. Leftover readers in code are optional cleanup, not a requirement to preserve forever.

## Rules

1. **Never break existing public saves.** After an update, every previously saved hero/account under the current public keys must load without data loss. Prefer additive changes.
2. **All domain persistence goes through `src/shared/lib/storage.ts`.** New hero/account fields land on `HeroRecord` / `AccountShared` (or nested types), not new ad-hoc domain keys.
3. **Normalize every load.** Extend `normalizeHero` / `normalizeAccount` (and helpers) so missing fields get safe defaults. Do not assume every saved record has every field.
4. **New fields: default empty/null + show “missing” when it matters.** Choose a sentinel that means “user never set this” (often `0`, `null`, or `{}`). When advice or math depends on that field, wire **`FieldRequired` beside the label** (and a tab soft/warn **dot + Tooltip** when the tab’s data would be wrong — see [`animation.md`](../../../docs/animation.md) rule 8). Do **not** use warn outlines/borders on panels or inputs for required state. Do **not** invent a “looks filled” default that hides a real gap — but identity defaults that are valid for new users (e.g. skill tree `danoTotal === 1`) are **not** missing and must not get required chrome.
5. **Do not rename or remove persisted field names without a migrator.** JSON field names on hero/account records, and game ids used as keys (rarity, ability, slot, …), stay stable — same spirit as [`i18n.md`](../../../docs/i18n.md) id stability. Breaking renames require reading the old shape → writing the new shape. Keep temporary `@deprecated` readers only until that migrator is proven, then remove them.
6. **Bump the storage key version only for incompatible shapes.** Additive fields stay on `-v1` via normalize. Incompatible layout → new key (`-v2`) + one-shot migrate from the previous public key.
7. **Prove it.** Add or adjust unit tests for: partial record → normalize; old public shape → migrate when you change shape; optional new field absent → default + missing-UX predicate when applicable.
8. **UI chrome prefs may stay separate.** They must remain tolerant of absence; never put hero/account domain data there.

### HeroRecord fields (additive on `-v1`)

| Field | Default | Notes |
| --- | --- | --- |
| `battleAllowed` | `true` | From save `battle_allowed`. Display-only; does not affect planner math. |
| `skin` | `0` | From save `skin` (0–6; `HERO_SKIN_COUNT` in `wiki-assets.ts`). Display-only cosmetic avatar index. |
| `sourceId` | **required for roster** | Save export hero id. Heroes without a non-empty `sourceId` are **dropped on load** (see [`import-only-heroes.md`](import-only-heroes.md)). `importHeroes()` always sets it; `normalizeHero` keeps it when present. |
| `luck` | `0` | On `naked`, `gearedOverride` and `pts` (`SheetStats` / `PointAlloc`, BSP-40). Stored in **percent** (Bellatrix ≈ 17.76), not the save's fraction — see `AD-BSP-19a`. Pre-`luck` records load with `0` filled by `normalizeSheetStats` / `normalizePointAlloc`; the key stays `bf-hp-heroes-v1` (additive, rule 6). Displayed as an eighth sheet stat since Wave 6 (`SHEET_PANEL_KEYS`, sheet table / Points table / Effective panel / ledger breakdown via `ledgerLuck`) but deliberately **never scored for DPS** — `AD-BSP-20`'s "not displayed yet" is stale after this wave. |
| `birth` | omit / `undefined` | Birth roll in planner units from save `birth_stats`. Additive — missing until re-import. The read-only Stats panel recomposes Total via `peelSheetStages` / `composeSheetFromBirth` when present; without it the panel shows need chrome and asks for a fresh import. |
| `abilities` (levels) | copied verbatim | Ability ranks are stored **uncapped** — `normalizeHero` copies `raw.abilities` with no clamp, no key filter (`storage.ts`). The catalog's `AbilityDef.max` (20 as of `AD-BSP-18`, W3) is a **UI/authoring bound** (stepper cap, `abilityPointBudget`), not a persistence bound: a record with a level above the current `max` (impossible from a save today, possible from hand-edited storage) loads and renders as-is, with the stepper's `+` disabled. Raising `max` in a catalog update is purely additive for persistence — no migrator needed (rule 6). |

**Re-import by `sourceId`:** When a save hero matches an existing imported hero, the planner **preserves** `naked`, `pts`, `altLoadout`, `level`, `stars`, `abilities`, and `rarity`, and **refreshes** `loadout`, save metadata (`rank`, `power`, `deployed`, `battleAllowed`, `skin`), and recomputed `gearedOverride` (pre-points `applyGear` only — simulated points stay in `pts` and are layered in derive). First import still reverse-sheets full stats from the export. With this wave, `birth` is written on import and overwritten on re-import via `mergeImportedHero`'s incoming spread.

Imported heroes store their **fixed ability pool** in `abilities`, including **level 0** slots from the save export. The Abilities tab and roster icons show only that pool — not the full 20-ability catalog.

### TreeState fields (additive on `-v1`)

| Field | Default | Notes |
| --- | --- | --- |
| `luckFlatPct` | `0` | From save `skills.totals.luck_add × 100` — flat Luck percentage points added after gear/points (`AD-BSP-22`, `ASM-01`). Populated by `mapAccountData` (`import-save.ts`) and threaded into `computeAdvisorPipeline`'s `treeSheet.luckFlatPct` (Wave 5, `BSPW5-03`). Pre-Wave-5 records load with `0` via `normalizeAccount`'s default spread; the key stays `bf-hp-account-v1` (additive, rule 6). Import-sourced only — no Account UI field yet (`CARRY-05`, Wave 6).

### HeroContext fields (behavior change on `-v1`)

| Field | Default | Notes |
| --- | --- | --- |
| `targetProp` | `'stone'` (was `null`) | Ranking/HTK prop on `HeroContext` (`AccountShared.context`, key `bf-hp-account-v1`). Previously normalized absent/empty-string to `null`, which `isTargetPropUnset` read as true and the Account tab soft-dotted. `DEFAULT_CONTEXT` and `normalizeContext` (`storage.ts`) now coerce absence/`''` to `DEFAULT_TARGET_PROP` (`'stone'`, `farm-context.ts`) — matching the Account target-prop `Select`'s own default, which can no longer emit `''`. `isTargetPropUnset` still exists as a guard, but is now reachable only via hand-edited localStorage that bypasses normalization, not through any normal load/import/UI path. Records with an explicit non-empty `targetProp` are unaffected either way. |

### Removed fields

| Field | Removed | Notes |
| --- | --- | --- |
| `obsHit` / `obsCrit` | AD-BSP-30 / BSP-56 | Per-hero observed-hit inputs for the removed Math-check UI; had no reader on any shipped surface. Records carrying them **load without error**, with the fields discarded on normalize. The storage key stayed `bf-hp-heroes-v1` (no `-v2` bump) — this is a **stated exception to rule 5** (removals need a migrator): a migrator moves data forward, and there was nothing downstream to move it to, since `normalizeHero` rebuilds every record from a fixed field list and was already discarding unknown keys. |

### Intentional breaking change (import-only roster)

Heroes saved under `-v1` **without** `sourceId` are removed the first time `loadHeroes()` runs after this policy ships. That is accepted product behavior — document in release notes, do not migrate them into imported heroes. See [`import-only-heroes.md`](import-only-heroes.md).

## Anti-patterns

| Avoid | Prefer |
| --- | --- |
| Assume every save has the newest fields | `normalize*` + defaults |
| Rename `gearedOverride` / bump to `-v2` for an additive field | Add field + normalize default |
| Default a required input to a valid-looking value with no need chrome | Unset sentinel + `FieldRequired` beside the label |
| Treat skill tree ×1 as “required missing” | Leave ×1 alone; it is a valid new-user default |
| Warn outline / orange input border for required | `FieldRequired` text only |
| Write hero stats to a new `localStorage` key from a panel | Extend `HeroRecord` / `AccountShared` in `storage.ts` |
| Rely on pre-public `bf-pa-*` (or other private) shapes as product truth | Public `bf-hp-*` only |
