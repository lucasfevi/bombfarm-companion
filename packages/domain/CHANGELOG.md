# @bombfarm/domain

## 0.3.0

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

## 0.2.0

### Minor Changes

- aa49f26: The Team Plan roster gear optimizer now honours a hero's banked, unspent stat points
  (`HeroRecord.statPointsAvailable`), same as the single-hero Planner (PR #34). `HeroPlanContext`
  and `TeamPlanHeroInput` gained a `statPointsAvailable` field, threaded into both of the solver's
  points passes (`solver-search.ts`'s `pointsPass`, `waterfall.ts`'s `finalPtsFromOptimizeBuild`) as
  `ReoptInput.statPointsAvailable`. Previously the Team Plan solver always called
  `findGateCandidate`/`optimizeBuild` with the field defaulted to 0, so a hero with banked points
  could get different point-allocation advice from the Planner than from the Team Plan page for the
  same account state — the Team Plan run silently ignored the banked points.

## 0.1.0

### Minor Changes

- f76884a: Team Plan hero panel: add a "Hit damage" grid showing current/expected normal and critical single-target hit damage, so a player can validate the model against numbers read off the game screen (`HeroScore`/`TeamPlanPerHeroRow` now carry `hit` alongside `sustained`/`active`, at no extra evaluation cost — `derive()` already returns it; Critical is derived at display time as `hit × (1 + critDmg / 100)`, matching the Planner's `predCrit`).

  Add a Luck row to the panel's "Hero sheet" grid (`TeamPlanHeroStats` now carries `luck`, following the Planner's own sheet-table Luck row). Luck has no combat transformation — it never reaches `HeroSheet` — so it has no Combat-stats row and stays display-only: it does not feed DPS scoring, the point-search `REOPT_KEYS`, or any ranking.

- dc14dd9: Add the roster gear optimizer: domain solver and scorer, web worker runner, Team plan page with scope controls, waterfall results, per-hero proposed gear, and disclosures (plan-only — no hero writes).
- dc14dd9: Redesign the team plan's per-hero results as expandable per-hero rows (avatar, rank, rarity, level) instead of a plain table. Expanding a row reveals a detailed breakdown: the per-stat before/after change, the recommended point reset (or a note that none applies), and the hero's proposed final gear — shown at the forge level the plan actually expects (`forgeFloorApplied`), not each item's raw stored upgrade. Large DPS figures across the results page are now abbreviated (e.g. `1.9bi`) with the exact value in a themed tooltip on hover/focus.
- 89d0876: The point optimiser (`findGateCandidate` Tier 1 and `optimizeBuild` Tier 2, `points-reopt.ts`) now folds a hero's banked, unspent stat points (`stat_points_available` from the save) into its search budget instead of only reallocating already-spent points. A hero with 0 spent and N unspent points previously tripped the `budget <= 0` fast path and got no recommendation at all — the search now runs and can place those points, in both the automatic reset gate and the Points tab's on-demand "Optimize build".

  `HeroRecord` now persists `statPointsAvailable` (additive, defaults to 0 for existing records — no behaviour change on upgrade). `ReoptInput.statPointsAvailable` is optional and defaults to 0, so callers that don't have a per-hero banked count wired through yet (the Team Plan solver's points passes) keep today's exact behaviour.

  The Points tab surfaces the banked count next to the spent/level counter (`+{count} unspent`) so a hero the optimiser now touches despite an unchanged spent total reads as banked points being spent, not as a bug.

### Patch Changes

- dc14dd9: Suppress Glass Cannon crit ×2 when Abisso is on; keep energy ×0.5 and add an Account toggle.
- 89d0876: Read `crit_dmg_mult` as the persisted numeric in the advisor pipeline instead of re-deriving `treeGlassCannon ? 2 : 1`. `detectGlassCannon` flags the keystone for any value at or above 1.5, so a save carrying anything other than exactly 2 previously showed different crit damage depending on which code path rendered it.
- c498b77: Import and expose the account's farm phase (`account.phase`) as an editable Account field, and model Abisso's damage multiplier (`abissoBase^currentPhase`) in the combat pipeline instead of dropping it silently.
- 52e69d6: Fix Glass Cannon and Tempo Dobrado sheet math: move crit-damage ×2, energy ×0.5, and speed ×1.33333 from combat multipliers to the sheet layer (matching the game), fixing corrupted spent-point inference on keystone accounts.
- dc14dd9: The Phases page's squad table now ranks and sums by your account's actual casa slot count instead of a hardcoded "Top 9" — a smaller or larger house now shows the right number of heroes, with the section heading and DPS tooltip updated to match.
- f76884a: Fix `peelSheetSources` dropping all three keystone sheet effects, which broke its documented AC-10 sum identity on keystone accounts — energy by a factor of 2, speed by ~0.80x and crit damage by 0.72–0.85x. Both keystone contributions land on the skill-tree line, matching the game's own stat tooltip.
- 3d3d70e: Add `gameSheetView`, a display-time clamp matching the game's exported sheet (crit chance at 100%, CDR at 80%; penetration is never clamped). The Planner's Stats panel now shows an "Over cap" column so a player can see how much of an over-cap stat is being wasted, without changing the underlying uncapped `total` the telescoping columns sum to. The Team Plan hero panel now shows two stacked stat grids — "Hero sheet" (capped, matching the in-game panel) and "Combat stats" (uncapped, aura-inclusive) — instead of one combat-only grid.

  Fix `selectTreeSheetTotals` (the planner store's `TreeSheetTotals` builder used by level/stars/gear recomposition and by Team Plan scoring), which had been missed by the prior keystone sheet-math correction: it hardcoded `critDmgMult: 1` and never carried `glassCannon`/`tempoDobrado` through at all, so every hero sheet recomposed from store state — including the whole Team Plan objective — ran Glass Cannon and Tempo Dobrado free even for accounts that own them. Glass Cannon's crit-damage multiplier (`skills.totals.crit_dmg_mult`) is now persisted on import (`TreeState.critDmgMult`, defaulting to `1` for existing saves) instead of re-derived from the `glassCannon` boolean, matching how `abissoBase` is already persisted.

- 020e680: Make the team plan finish in seconds rather than minutes. The gear search fully evaluated every candidate move — around 1,250 roster evaluations — to apply just one of them; it now ranks them with a screen that rescores only the heroes a move touches and fully evaluates the best twenty. Screening alone would have cost plan quality, so when the beam runs out of improving moves the search hands back to the exhaustive one and finishes from there, which means the plan it settles on is still a local optimum of the full candidate set. Measured across six real saves spanning 10–16 heroes and phases 151–600, this reaches the same plan DPS three to eight times faster (87 s to 22 s on the largest), and five of the six produce a byte-identical plan; the sixth differs only by two heroes trading equally-scoring rings. It also now converges on every one of those saves, where the exhaustive search previously ran out of evaluation budget mid-climb on three of them.
- 020e680: Stop the team-plan search evaluating interchangeable spare gear more than once. Every copy of an item with the same def, rarity, level and effective forge produces a byte-identical equipped item and so an identical objective; only one now enters the candidate list, with multiplicity still tracked by the pool. On a real 441-item save that cuts assign candidates to 45% and reaches the same plan in half the evaluations.
- 020e680: Prune strictly-dominated spare gear from the team-plan search, and lower the evaluation budget to 250,000 now that it converges. At the same set and level a higher rarity is always superior, and on the same item a higher forge is — so those candidates can never win and no longer cost an evaluation. On a real 441-item save the plan improves 10% (4.489e+11 to 4.952e+11) while taking a third less time, and the search now reaches convergence instead of always being cut off.
- dc14dd9: Fix the team plan's per-hero scoring double-counting a hero's spent stat points, which inflated the "Before" DPS/stat figures shown in the results (e.g. attack and crit damage read far above the in-game sheet). The scorer now composes its combat sheet with zero spent points before handing it to `derive()`, which already applies the real points itself — matching the contract used elsewhere in the pipeline. Also add a note under "Per-hero changes" clarifying that these figures are combat-effective (team auras applied, not clamped to the game's display caps) rather than a copy of the in-game hero panel, since that's what lets the optimizer find the best real DPS.
- dc14dd9: Merge the team plan's separate forge list and move list into the per-hero results: each hero's "Proposed gear" section now shows a card per item the plan actually touches (icon with level/forge overlays, item name, where it's coming from — another hero or the inventory — and the forge delta when it's being upgraded), instead of two flat chore lists disconnected from the per-hero breakdown. Items the plan leaves untouched no longer clutter the section, and a hero with no gear changes shows a short empty note instead of an empty list. The forge recommendation itself is also more precise: gear that ends the plan sitting unequipped in the shared inventory pool is no longer recommended for forging, since it never reaches combat.
- e284962: Fix the roster gear optimizer proposing pointless swaps of items that are identical down to their rolled stats: the plan now keeps interchangeable gear on the hero already wearing it, so the move list is strictly shorter and the recommended DPS is unchanged. Where the choice is still open it equips the already-forged copy and leaves the one that would need forging in the pool, which usually shortens the forge list too — though a hero already wearing the less-forged copy keeps it, so that list can occasionally be one entry longer.
- 020e680: Cut team-plan runtime roughly in half without changing a single result. The per-hero score memo lived inside `evaluateRoster`, so a candidate differing in one hero's gear rescored all fifteen from scratch; it now spans the whole run, where 97.1% of score lookups hit a key already computed (the previous per-call memo hit 0.0% of the time). Profiling the result showed the search had become bookkeeping-bound rather than math-bound — building memo keys cost ~29% of a run and recomputing team auras 14%, against 0.4% for the actual scoring — so the ability-catalog lookup is now resolved once, the forge-floored loadout is built once per evaluation instead of once per fixed-point round, and the key builders walk fixed key lists instead of sorting object entries. On a real 348-item, 15-hero save the plan takes 122 s instead of 167 s at the full budget, and the emitted plan is byte-identical at every budget.
- 020e680: Stop the team plan exhausting browser memory on large inventories. The solver's memoisation cache was unbounded — its only ceiling was the 500,000-evaluation budget — and each key re-serialised the entire spare pool plus the point allocation, neither of which discriminates. On a real 441-item save that reached multiple gigabytes and killed the tab; the same run now peaks at 144 MB.
- dc14dd9: Fix the roster gear optimizer recommending chores (forge to floor, gear moves, point resets) whose combined roster DPS delta was negative. The waterfall now decides rather than reports: forging and moves are chosen jointly on their end-state DPS instead of an isolated forge-only delta, and point resets are accepted one hero at a time against the roster objective instead of each hero's own DPS. Two guarantees hold unconditionally: the final plan is never below today's DPS, and the point-reset step itself never loses DPS. The intermediate gear step (forge + moves, before the resets land) may transiently dip below today when that dip pays off once the resets are applied — the plan discloses this explicitly (`requiresFullPlan` / `gearDipDps`) rather than hiding or discarding a plan that would otherwise be the best available. A hero can still personally lose DPS when a trade grows the roster total. Point-reset rows now also show the real in-game reset cost (`heroLevel × 1000` gold) and the marginal roster DPS gained at the moment each reset was accepted — both display-only, never gating or filtering a recommendation — and are listed in acceptance (priority) order rather than alphabetically. The search itself now runs to local optimality each round (previously capped at one move per round), which is measured to add +1.6% to +5.7% roster DPS beyond the fix itself. The waterfall changes from four steps (today/forged/moved/respec) to three (today/gear/respec), with the forge/move split retained as a disclosure-only breakdown.
- dc14dd9: Fix the team plan solver proposing an item above a hero's level: the swap move family (trading two heroes' same-slot items) didn't recheck level eligibility on the item's new owner, only assign-from-pool moves did. A high-level hero's item could get swapped onto a lower-level hero even though it's above what that hero can equip. Also fixed hero level display on the team plan results page to consistently read "Lv 82" instead of "L82"/"Lv82".
