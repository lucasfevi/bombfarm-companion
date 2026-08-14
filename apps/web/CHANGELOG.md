# @bombfarm/web

## 0.5.0

### Minor Changes

- 453ed05: **The drift guard can now see the change it was built to catch.** The 2026-08-13 game patch
  reshaped `skills.totals` and the mechanism meant to notice — `fingerprints.ts` — ran on every CI
  job and passed, because it only checked top-level key presence and never treated an added key as
  a failure. This change deepens the guard and uses it to reject stale data on both surfaces.

  **Deepened fingerprint (`@bombfarm/domain`, `@bombfarm/game-api`):** the schema check now descends
  into declared nested paths (`skills.totals`, `heroes[]`, `items[]`, `casa`, `account`) instead of
  only the top level, and an **added** key is now fatal at every declared level, not only a missing
  one. The five API route bodies and the save-export file's own shape are fingerprinted from one
  shared key catalogue. `RouteFingerprint.requiredKeys` (a flat, subset-checked list) is gone;
  `checkShape` no longer has an `{ ok: true, unknownKeys }` branch.

  **New rejection reason (`@bombfarm/domain`, `@bombfarm/web`):** importing a save file now checks
  for the presence of the patch's new keys (`skills.refunds`, `skills.totals.vagas_campo`,
  `skills.totals.bag_tabs_bonus`) before parsing. A save missing them — pre-patch or truncated — is
  rejected with a new generic message, in EN and PT-BR, that names no keystone, version, date or
  field path so it stays accurate after the next patch. The specific missing keys are still recorded
  in `ParseResult.warnings` for diagnosis.

  **Two drop rules, never a migration (`@bombfarm/web`, `@bombfarm/desktop`):** a locally stored
  planner account on the web, or a stored SQLite account section on desktop, that still carries a
  retired keystone field (or fails its own fingerprint) is dropped and deleted rather than served or
  patched up. Clean stored data is left byte-unchanged. Neither surface gains a new upload affordance.

- fc7fcf1: **Every player-facing and internal surface that could still express the five removed keystones is
  gone.** `@bombfarm/domain` stopped modelling Abisso, Glass Cannon and Tempo Dobrado (MP5 F2); this
  change removes the last ways a player or a maintainer could still see, toggle, persist or key on
  them.

  **Removed controls (`@bombfarm/web`, rendered Account panel, both `pt` and `en`):**

  - The three `Switch` toggles — **Abisso**, **Glass Cannon**, **Tempo Dobrado** — and their On/Off
    status readouts. The Skill Tree subsection is now six read-only `<output>` rows with no input,
    button or switch/checkbox role anywhere inside it.
  - The three conditional import-preview rows in the account-import summary.
  - The advice column's forwarding of the two keystone-only fields into the breakdown model.

  **Removed i18n keys, EN and PT-BR (12 keys × 2 languages):** `treeGlassCannon`,
  `treeGlassCannonHint`, `treeAbisso`, `treeAbissoHint`, `treeTempoDobrado`,
  `treeTempoDobradoHint`, `keystoneOn`/`keystoneOff` (PT `Sim`/`Não`), `importKeystoneOn` (PT
  `Ativo`), `bdNoteGlassCannon`, `bdNoteTempoDobrado`, `bdTermAbisso`. Surviving prose in both
  languages (account hints, the damage formula's `× abisso` factor, and the planner's explain-section
  text) no longer names any of the three mechanics.

  **Removed `TreeState` fields (`@bombfarm/web`):** `glassCannon`, `tempoDobrado`, `abisso`,
  `abissoBase`, `critDmgMult` — gone from the type, `DEFAULT_TREE`, every selector, the store's
  setters (`setTreeGlassCannon`, `setTreeTempoDobrado`, `setTreeAbisso`) and the team-plan input
  builder. A stored account written before this change still loads; the dead fields are discarded on
  normalize, not fatal.

  **Removed `@bombfarm/ui` exports:** `accountKeystoneControlClass` and
  `accountKeystoneStatusClass` (`panel-field.recipe.ts`), plus the two `[&_label_[data-keystone-control]]`
  arbitrary variants inside `stackFieldsClass`. The Storybook `switch.stories.tsx` stories keep their
  ids and count (3 → 3), re-labelled and re-skinned onto a surviving row.

  **`@bombfarm/desktop` (internal, no user-facing change):** `CHANGE_KEY_INPUTS` and
  `sharedChangeKey` no longer key on the four dead tree paths, and `account-model.ts` no longer maps
  the five fields into the shared account shape.

### Patch Changes

- a0a126b: **The pre-v4 capture corpus is removed and replaced.** The 2026-08-13 patch removed all five
  keystones and wiped every account; the 41 committed capture files this repo's test suites were
  built on described an account the game can no longer produce. The 20 quarantined suites (the
  files carrying the catalog-v4 quarantine header) and all 39 stale `sheet-math` fixtures (plus the
  old fidelity-gate capture pair) are deleted, and the ~30 surviving suites that depended on them
  are re-pointed onto a new, post-patch corpus: a scrubbed 2026-08-13 save export
  (`save-20260813-5heroes.json`, 5 heroes) and an already-committed API-assembled payload
  (`payload-20260812-8heroes.json`, 8 heroes). The fidelity-gate capture pair is re-captured from
  the new export and its eight-mutant discrimination suite is re-proven red against it.

  **No runtime behaviour changes for the web planner or the desktop.** This is a test-fixture and
  test-suite rebaseline only — `packages/domain/src`, `apps/web/src` (non-test) and `packages/ui`
  are untouched. `@bombfarm/desktop` is included because its recompute-budget test reads a fixture
  this feature deletes (`apps/desktop/renderer/lib/planning/recompute-budget.test.ts`), not because
  any desktop-rendered number changes.

- 829228c: **Optimize build and the Team Plan now respect the hero's level.** A hero with banked, unspent
  stat points could be walked far past its own level: a level-46 hero with 46 unspent points got a
  46-point build on the first Optimize, then 92 on the second, 138 on the third — and the Team Plan
  page's Point Reset table inflated the same way, on top of whatever the Planner had already
  proposed. The Points panel's `spent / level` counter went red and stayed red, while the `+/-`
  steppers refused the very spend the optimizer had just made.

  The budget was `budgetOf(pts) + statPointsAvailable`. That second term is what the save reported
  as banked at import time — a snapshot of `level - spent` — and it never shrank as those points
  got spent in the planner, so every Optimize -> Apply round counted them again.

  It is replaced by two budgets, because the two searches answer different questions:

  - **Optimize build** ("what is the best build?") gets `reoptBudget(pts, level)` —
    `max(level - pts.luck, budgetOf(pts))`. The hero's whole pool, matching the ceiling
    `clampPointStep` has always enforced for the manual steppers, floored at what is already
    placed so a hero whose level was lowered after spending can still reallocate what it holds.
  - **The reset gate** ("is a real in-game reset worth buying?") gets `budgetOf(pts)`. A reset only
    moves points that are already spent, so a hero with points still unplaced no longer gets a
    respec recommendation it has no use for — the Points panel's unspent counter and the Optimize
    button are what surface that hero's actual next action. This also quiets the roster banner and
    the Points warn dot for freshly imported, unallocated heroes.

  Neither budget can compound: each search places at most what it was given, so feeding a result
  back in is non-increasing and settles immediately.

  `ReoptInput` takes `level` in place of `statPointsAvailable`; `HeroPlanContext` and
  `AdvisorPipelineInput` drop the field entirely, so the stale value cannot be threaded back in.
  `HeroRecord.statPointsAvailable` is unchanged and still persisted — it remains what the save
  reported, which is what `point-inference.ts`'s budget-mismatch check reads. The Points panel's
  "+N unspent" note is now derived live from `level - spentDelta`, so it stops advertising points
  that have since been spent, and the disabled-Optimize reason no longer says "nothing spent to
  move" for the one case that is now enabled.

- Updated dependencies [f0bf7f4]
- Updated dependencies [96d496a]
- Updated dependencies [a0a126b]
- Updated dependencies [fc7fcf1]
- Updated dependencies [453ed05]
- Updated dependencies [fc7fcf1]
- Updated dependencies [829228c]
  - @bombfarm/domain@0.5.0
  - @bombfarm/ui@0.3.0

## 0.4.1

### Patch Changes

- Updated dependencies [66d38d0]
- Updated dependencies [e55ebda]
  - @bombfarm/domain@0.4.0

## 0.4.0

### Minor Changes

- e2638f8: Refresh the item catalog to the game's v4 balance patch and teach the gear math the new
  two-regime Dano.

  `packages/domain/src/data/catalog.json` is regenerated from the wiki's live payload. Every stat
  base is exactly ×0.7 of the previous values (Dano 27.5 → 19.25, Energia 0.05 → 0.035, Velocidade
  0.0011 → 0.00077, Sorte 0.044 → 0.0308, Crítico 0.088 → 0.0616, Penetração 0.2 → 0.14, Cooldown
  0.266667 → 0.1866669). The catalog's shape is unchanged — same 216 definitions, ids, slots, native
  levels, per-def stat orderings, levels 10–90 and rarities 0–5. No new sets, slots, tiers or rarities.

  Dano now has two regimes. Below item level 50 it stays a flat number on the `nivelMult` ladder; at
  level 50 and above it becomes a fraction of the hero's Attack — 10/15/20/25/30% at nv 50/60/70/80/90.
  The catalog carries this as `dmgPctMinLevel` plus a `dmgPct` ladder, `scaledValores` resolves the
  regime from the _item's_ level (a definition can be scaled across the boundary) and tags each roll
  `unit: 'flat' | 'pct'`, and `GearBonuses` gained a `dmgPct` field alongside `dmgFlat`. The planner's
  per-slot stat grid and the Totals table render the new percent rolls as percentages, with a new
  "Dano (% da Ataque)" / "Damage (% of Attack)" row.

  The wiki documents the regime but not which Attack the percentage multiplies. We assume it applies
  to the naked attack, with flat gear Dano and spent attack points added outside the product, matching
  how every other percent stat is already pooled. That assumption is isolated in `composeAttack` /
  `decomposeAttack` in `gear/catalog.ts`; every call site routes through them.

  Also fixes `inferSpentPoints` returning `-0` for a point count when the solved value rounds to
  negative zero, which leaked into stored hero records.

- e2638f8: Surface the maintainer's in-game referral code in the footer, next to the existing wiki credit
  and coffee link — visible on every page without sitting in the planner workflow.

  The code renders from a single `REFERRAL_CODE` constant (`shared/referral.ts`) with a copy button.
  The copy uses the clipboard API and confirms with the app's existing toast; when the clipboard is
  unavailable — insecure origin, or a denied permission — it selects the code text and says so
  instead, so the click always has a visible effect. The copy control carries an accessible name and
  a 24px target, and the wording states the reward is mutual rather than framing it as a one-way
  favour. Strings are localized in both en and pt.

### Patch Changes

- e2638f8: Add the referral code to the topbar as a compact chip — the code and a copy icon, nothing else.
  The reason it exists ("we both get a reward once you clear stage 151") moves into its tooltip, so
  the control stays terse in the header while the footer keeps the full sentence.

  Both referral controls now use the `Tooltip` primitive from `@bombfarm/ui` instead of a native
  `title` attribute, and share one `useReferralCopy` hook rather than duplicating the
  clipboard-with-manual-selection fallback.

- Updated dependencies [e2638f8]
  - @bombfarm/domain@0.3.0

## 0.3.0

### Minor Changes

- aa49f26: The Team Plan roster gear optimizer now honours a hero's banked, unspent stat points
  (`HeroRecord.statPointsAvailable`), same as the single-hero Planner (PR #34). `HeroPlanContext`
  and `TeamPlanHeroInput` gained a `statPointsAvailable` field, threaded into both of the solver's
  points passes (`solver-search.ts`'s `pointsPass`, `waterfall.ts`'s `finalPtsFromOptimizeBuild`) as
  `ReoptInput.statPointsAvailable`. Previously the Team Plan solver always called
  `findGateCandidate`/`optimizeBuild` with the field defaulted to 0, so a hero with banked points
  could get different point-allocation advice from the Planner than from the Team Plan page for the
  same account state — the Team Plan run silently ignored the banked points.

### Patch Changes

- 26b8a68: Make the build-output bundle assertions actually run in CI.

  `ci-web.yml` ran the web unit tests before `pnpm --filter @bombfarm/web build`, so `apps/web/out`
  never existed while the suite ran. Both tests that assert on real build output —
  `team-plan-worker-bundle` (the team-plan worker chunk actually ships) and
  `devtools-not-in-production-bundle` (zustand devtools does not) — guarded themselves with a silent
  `return`, took that branch on every CI run, and reported green without verifying anything.

  The build step now runs before the web unit tests, and the skip branch is local-only: under `CI` a
  missing build throws with a message pointing at the workflow ordering. Domain tests still run ahead
  of the build to keep fast feedback. Also removed a tautological test in `team-plan-worker-bundle`
  that asserted `existsSync(out)` in both of its branches and so could never fail.

- dc82f15: Storybook ownership moves from `apps/web` (`@storybook/nextjs`) to `packages/ui`
  (`@storybook/react-vite`) — the catalog now lives with the package it documents.
  Fonts are self-hosted via `@fontsource` instead of `next/font/google`. Adds
  `@storybook/addon-a11y` and a `@storybook/test-runner` gate (`pnpm --filter
@bombfarm/ui test-storybook`) that smoke-renders every story and asserts zero
  accessibility violations, wired into CI on the existing `web` path filter.

  Fixing the a11y violations the new gate found touches a few components' visible
  chrome: `Banner` now renders a `<div role="status">` instead of `<aside
role="status">` (an `<aside>`'s implicit landmark role doesn't permit overriding to
  `status`); the "warn" chip/`StatusChip` tone and `AbilityCard`'s locked-out dimming
  and `Panel`'s unverified dimming are all slightly lighter, raised to clear WCAG AA
  contrast; `FileDropZone`'s inner "Choose file" control is no longer a second
  keyboard tab stop (it was decorative — the drop zone's own `role="button"` wrapper
  already handled activation).

  `apps/web` no longer hosts or depends on Storybook.

- dc82f15: Housekeeping after the Storybook move, no runtime behaviour change. `apps/web`'s
  TypeScript config no longer includes the deleted local `.storybook/` directory, and
  root ESLint now lints `packages/ui` story files (with type checking off, since they
  sit outside the package tsconfig) so the raw `react-icons` / `*.svg` import ban that
  guards the `Icon` seam applies to stories too, not just to product code.
- Updated dependencies [dc82f15]
- Updated dependencies [dc82f15]
- Updated dependencies [dc82f15]
- Updated dependencies [dc82f15]
- Updated dependencies [aa49f26]
  - @bombfarm/ui@0.2.0
  - @bombfarm/domain@0.2.0

## 0.2.1

### Patch Changes

- b2b1c29: Team Plan hero panel: fix the "Hero sheet" grid always showing Luck last, regardless of the game's own stat order. It now follows the same Attack → Energy → Speed → Luck → Crit % → Crit dmg → Pen % → CDR order as the Planner sheet/points tables (`SHEET_PANEL_KEYS`), so the panel matches what the game shows.

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
