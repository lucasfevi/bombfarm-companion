# @bombfarm/web

## 0.2.0

### Minor Changes

- f76884a: Team Plan hero panel: add a "Hit damage" grid showing current/expected normal and critical single-target hit damage, so a player can validate the model against numbers read off the game screen (`HeroScore`/`TeamPlanPerHeroRow` now carry `hit` alongside `sustained`/`active`, at no extra evaluation cost — `derive()` already returns it; Critical is derived at display time as `hit × (1 + critDmg / 100)`, matching the Planner's `predCrit`).

  Add a Luck row to the panel's "Hero sheet" grid (`TeamPlanHeroStats` now carries `luck`, following the Planner's own sheet-table Luck row). Luck has no combat transformation — it never reaches `HeroSheet` — so it has no Combat-stats row and stays display-only: it does not feed DPS scoring, the point-search `REOPT_KEYS`, or any ranking.

- dc14dd9: Add the roster gear optimizer: domain solver and scorer, web worker runner, Team plan page with scope controls, waterfall results, per-hero proposed gear, and disclosures (plan-only — no hero writes).
- dc14dd9: Merge the team plan's separate forge list and move list into the per-hero results: each hero's "Proposed gear" section now shows a card per item the plan actually touches (icon with level/forge overlays, item name, where it's coming from — another hero or the inventory — and the forge delta when it's being upgraded), instead of two flat chore lists disconnected from the per-hero breakdown. Items the plan leaves untouched no longer clutter the section, and a hero with no gear changes shows a short empty note instead of an empty list. The forge recommendation itself is also more precise: gear that ends the plan sitting unequipped in the shared inventory pool is no longer recommended for forging, since it never reaches combat.
- dc14dd9: Redesign the team plan's per-hero results as expandable per-hero rows (avatar, rank, rarity, level) instead of a plain table. Expanding a row reveals a detailed breakdown: the per-stat before/after change, the recommended point reset (or a note that none applies), and the hero's proposed final gear — shown at the forge level the plan actually expects (`forgeFloorApplied`), not each item's raw stored upgrade. Large DPS figures across the results page are now abbreviated (e.g. `1.9bi`) with the exact value in a themed tooltip on hover/focus.
- 89d0876: The point optimiser (`findGateCandidate` Tier 1 and `optimizeBuild` Tier 2, `points-reopt.ts`) now folds a hero's banked, unspent stat points (`stat_points_available` from the save) into its search budget instead of only reallocating already-spent points. A hero with 0 spent and N unspent points previously tripped the `budget <= 0` fast path and got no recommendation at all — the search now runs and can place those points, in both the automatic reset gate and the Points tab's on-demand "Optimize build".

  `HeroRecord` now persists `statPointsAvailable` (additive, defaults to 0 for existing records — no behaviour change on upgrade). `ReoptInput.statPointsAvailable` is optional and defaults to 0, so callers that don't have a per-hero banked count wired through yet (the Team Plan solver's points passes) keep today's exact behaviour.

  The Points tab surfaces the banked count next to the spent/level counter (`+{count} unspent`) so a hero the optimiser now touches despite an unchanged spent total reads as banked points being spent, not as a bug.

### Patch Changes

- dc14dd9: Suppress Glass Cannon crit ×2 when Abisso is on; keep energy ×0.5 and add an Account toggle.
- 89d0876: Read `crit_dmg_mult` as the persisted numeric in the advisor pipeline instead of re-deriving `treeGlassCannon ? 2 : 1`. `detectGlassCannon` flags the keystone for any value at or above 1.5, so a save carrying anything other than exactly 2 previously showed different crit damage depending on which code path rendered it.
- c498b77: Import and expose the account's farm phase (`account.phase`) as an editable Account field, and model Abisso's damage multiplier (`abissoBase^currentPhase`) in the combat pipeline instead of dropping it silently.
- d2116e5: Add the `Icon` seam to `@bombfarm/ui`: closed `IconName` union over a UI-chrome registry (`react-icons`), design-system migrations, Storybook gallery, and lint enforcement. Game glyphs are out of scope.
- dc14dd9: The Phases page's squad table now ranks and sums by your account's actual casa slot count instead of a hardcoded "Top 9" — a smaller or larger house now shows the right number of heroes, with the section heading and DPS tooltip updated to match.
- dc14dd9: Removed the hover tooltip on each team-plan scope card's "Lv · #id" text. Its trigger stopped pointerdown propagation to keep the tooltip from firing during a drag, but that same handler blocked a drag from starting if you grabbed the card there — annoying on a board whose whole point is dragging cards between columns.
- 3d3d70e: Add `gameSheetView`, a display-time clamp matching the game's exported sheet (crit chance at 100%, CDR at 80%; penetration is never clamped). The Planner's Stats panel now shows an "Over cap" column so a player can see how much of an over-cap stat is being wasted, without changing the underlying uncapped `total` the telescoping columns sum to. The Team Plan hero panel now shows two stacked stat grids — "Hero sheet" (capped, matching the in-game panel) and "Combat stats" (uncapped, aura-inclusive) — instead of one combat-only grid.

  Fix `selectTreeSheetTotals` (the planner store's `TreeSheetTotals` builder used by level/stars/gear recomposition and by Team Plan scoring), which had been missed by the prior keystone sheet-math correction: it hardcoded `critDmgMult: 1` and never carried `glassCannon`/`tempoDobrado` through at all, so every hero sheet recomposed from store state — including the whole Team Plan objective — ran Glass Cannon and Tempo Dobrado free even for accounts that own them. Glass Cannon's crit-damage multiplier (`skills.totals.crit_dmg_mult`) is now persisted on import (`TreeState.critDmgMult`, defaulting to `1` for existing saves) instead of re-derived from the `glassCannon` boolean, matching how `abissoBase` is already persisted.

- 89d0876: Split `apps/web/src/shared/lib/storage.ts` — which had sat at its file-specific `max-lines` allowlist cap (354) with zero slack after four straight waves of bumping it instead of splitting — into `storage.ts` (hero-record persistence: `HeroRecord`, `loadHeroes`/`saveHeroes`/`upsertHero`/`importHeroes`/`deleteHero`, the localStorage read/write helpers) and a new `shared/lib/account-shared.ts` (the `AccountShared` concern: `TreeState`/`HeroContext`/`AccountShared` types, their `DEFAULT_*` factories, and their load-time normalizers). No behaviour change — every symbol `storage.ts` exported before is re-exported from the same path, and the storage test suite (including the `storage-roundtrip-20260729.json` byte-identity fixture) passes unmodified. The file-specific `max-lines` allowlist entry for `storage.ts` is removed; it now lives under the shared-lib default cap (300) with no bump.
- dc14dd9: Honor Donate / Leave alone defaults in the Team plan solver input instead of treating missing scope keys as Optimize.
- dc14dd9: Fix the team plan's per-hero scoring double-counting a hero's spent stat points, which inflated the "Before" DPS/stat figures shown in the results (e.g. attack and crit damage read far above the in-game sheet). The scorer now composes its combat sheet with zero spent points before handing it to `derive()`, which already applies the real points itself — matching the contract used elsewhere in the pipeline. Also add a note under "Per-hero changes" clarifying that these figures are combat-effective (team auras applied, not clamped to the game's display caps) rather than a copy of the in-game hero panel, since that's what lets the optimizer find the best real DPS.
- dc14dd9: Show kept gear on the optimizer's per-hero proposed items with explicit existing / no-change labeling.
- dc14dd9: Rename the roster gear optimizer chrome to Team plan (route `/team-plan`, Build team plan CTA).
- dc14dd9: Fix the Team plan's hero scope (Optimize / Donate / Leave alone) silently resetting to its battleAllowed-derived defaults on every page reload. Scope choices are now persisted to storage and restored at boot, alongside the existing inventory/account persistence — a hero moved out of Optimize stays out after a refresh instead of being counted in the plan again.
- dc14dd9: Fix the roster gear optimizer recommending chores (forge to floor, gear moves, point resets) whose combined roster DPS delta was negative. The waterfall now decides rather than reports: forging and moves are chosen jointly on their end-state DPS instead of an isolated forge-only delta, and point resets are accepted one hero at a time against the roster objective instead of each hero's own DPS. Two guarantees hold unconditionally: the final plan is never below today's DPS, and the point-reset step itself never loses DPS. The intermediate gear step (forge + moves, before the resets land) may transiently dip below today when that dip pays off once the resets are applied — the plan discloses this explicitly (`requiresFullPlan` / `gearDipDps`) rather than hiding or discarding a plan that would otherwise be the best available. A hero can still personally lose DPS when a trade grows the roster total. Point-reset rows now also show the real in-game reset cost (`heroLevel × 1000` gold) and the marginal roster DPS gained at the moment each reset was accepted — both display-only, never gating or filtering a recommendation — and are listed in acceptance (priority) order rather than alphabetically. The search itself now runs to local optimality each round (previously capped at one move per round), which is measured to add +1.6% to +5.7% roster DPS beyond the fix itself. The waterfall changes from four steps (today/forged/moved/respec) to three (today/gear/respec), with the forge/move split retained as a disclosure-only breakdown.
- dc14dd9: Fix the team plan solver proposing an item above a hero's level: the swap move family (trading two heroes' same-slot items) didn't recheck level eligibility on the item's new owner, only assign-from-pool moves did. A high-level hero's item could get swapped onto a lower-level hero even though it's above what that hero can equip. Also fixed hero level display on the team plan results page to consistently read "Lv 82" instead of "L82"/"Lv82".
- Updated dependencies [dc14dd9]
- Updated dependencies [89d0876]
- Updated dependencies [c498b77]
- Updated dependencies [f76884a]
- Updated dependencies [52e69d6]
- Updated dependencies [d2116e5]
- Updated dependencies [6ca8b4a]
- Updated dependencies [dc14dd9]
- Updated dependencies [dc14dd9]
- Updated dependencies [f76884a]
- Updated dependencies [3d3d70e]
- Updated dependencies [020e680]
- Updated dependencies [020e680]
- Updated dependencies [020e680]
- Updated dependencies [dc14dd9]
- Updated dependencies [dc14dd9]
- Updated dependencies [dc14dd9]
- Updated dependencies [e284962]
- Updated dependencies [020e680]
- Updated dependencies [020e680]
- Updated dependencies [dc14dd9]
- Updated dependencies [dc14dd9]
- Updated dependencies [89d0876]
  - @bombfarm/domain@0.1.0
  - @bombfarm/ui@0.1.0

## 0.1.0

### Minor Changes

- 3f8d4cb: Show the app version in the web footer and desktop shell, and carry version over the typed app-environment IPC boundary. Lands the changesets release rail (release PR, nightly, dormant prod).
