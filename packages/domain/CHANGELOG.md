# @bombfarm/domain

## 0.6.3

### Patch Changes

- d1dce84: Olho Clínico and Presságio Mortal grant flat Crit POINTS, not a share of the hero's roll.

  The 2026-08-23 balance patch restated both abilities in points — +40 and +20 at rank 20 — and the
  wiki's per-level entries moved with it. They were modelled as percentages of the bearer's own
  crit-chance roll, which is now wrong in both magnitude and shape: on a 5.08-roll hero, rank 20 used
  to add 4.36 crit points and now adds 40.

  A live capture pins all three parts of the new shape at once. One hero holds Olho Clínico at rank
  13, wears nothing and has spent no crit-chance points, so its exported crit chance is exactly
  `roll + 13 × 2 + roll × crit_chance_add` — which says the ability's contribution is flat, that the
  skill tree still reads the pre-ability roll, and that the addend sits outside the shared pool.
  Two geared rank-20 heroes add the gear leg: both solve to exactly zero spent crit-chance points
  under that reading, and to fractional negatives if the +40 rides inside the pool. Percent-of-base
  fits none of the three. Across the whole 13-hero roster every hero now solves to a whole-number
  point vector with no inference issues and a budget landing exactly on its level.

  Presságio Mortal's field cap moves with it, from 114.29% of base to a flat 20 points, and the
  team-buff field is now labelled in points.

  The crit-chance stat POINT is untouched and remains a percentage of the roll — this patch moved the
  two abilities, not the point.

  Alongside it, four values were resynced against the live wiki:

  - Hero attack rolls for Épico, Lendária and Mítico (300–400, 500–600, 1000–1200), and — not in the
    patch note, but confirmed by both the wiki and a save's own `stat_ranges` — Rare attack and five
    of the six energy ranges, which had drifted at some earlier patch.
  - The skill-stone chest on X-10 phases, from 0.005% to 0.05%.
  - The time chest, from 0.15% to 0.1%.
  - A ninth hero skin, so a hero wearing it imports with its own avatar instead of an "unknown skin"
    warning and a placeholder.

  Olho de Lapidador's description now says what the patch clarified: the upgraded drop belongs to the
  hero that destroyed the object, and Cages are excluded. Its rate is unchanged and it stays
  unmodelled.

  Any hero carrying either crit-chance ability sees a materially higher crit rate, and everything
  downstream of it moves: the Stats panel's crit-chance ledger, next-point ranking (crit damage is
  worth more the more often it lands), DPS, and the Farm board's throughput.

- Updated dependencies [a844381]
  - @bombfarm/contracts@0.3.4

## 0.6.2

### Patch Changes

- 8692c92: Add the in-run live data source, alongside the existing periodic account sync

  Groundwork for reading a running game session's live combat stream, so field and recovery
  countdowns can eventually be built from real, observed energy drain rather than only the modelled
  rate. Countdowns now carry where their number came from, and a number derived from the modelled
  rate is never presented as an observed measurement.

  The app reports whether it is reading live data and, when it is not, distinguishes a gap it could
  act on — never attached, permission not granted, the read went quiet — from one it cannot, such as
  the game being closed or idle. Recovery countdowns advance only while the game world is actually
  advancing, so they freeze rather than counting down through time that never happened. Revoking
  permission for the live read takes effect immediately, tearing the attachment down before the
  revoke is recorded.

  The live read itself is not enabled in this release: no instrumentation runtime ships yet, so the
  app runs in its no-live-data mode, serving the periodic account sync and labelling every countdown
  as modelled. That path is a supported state, not a failure.

- 587ed60: Prove the full-and-waiting rotation state against a real capture

  The fourth hero state — fully recovered and waiting for a field slot — was
  implemented against its documented shape but had never been seen in a committed
  body. A capture now carries it, along with the other three states, and the
  classification is asserted against that rather than against constructed heroes.

  The capture confirms the shape the classification was built on: a hero in that
  state is out of the house and off the field at once, which is the pairing that
  makes it impossible to identify from either flag alone.

- dbb38f1: Halve the per-star multiplier: a ★ now adds 25% of the hero's intrinsic base, not 50%.

  The wiki publishes this as `gemas.mult_por_estrela`, and it reads `0.25`. The shipped constant
  was `0.5`, measured in-game on 2026-07-23 — correct for that build, but a later patch compressed
  the whole curve, and the same patch cut every base drop rate, rescaled the hero XP curve and the
  item-stat bases, and reshaped the gem rank draw. Max stars stays 3, so a fully-starred hero's
  intrinsic base goes from ×2.5 to ×1.75.

  Only the magnitude moved. The scope is unchanged and still matches the 2026-07-23 measurement:
  Attack, Energy, Crit %, Crit Dmg, Penetration, CDR and Luck all scale; Speed does not.

  This affects any hero above ★0 — its sheet, its DPS, its farm ranking, and the gain the star
  upgrade advertises. ★0 heroes are untouched, since the factor is ×1 either way.

- da61de5: Fix the skill tree's crit-damage node being charged as a percentage of the hero's roll when the
  game adds it flat, which invented a stat point nobody spent.

  The node was modelled percent-of-base on the strength of the game's own wording, and no capture
  carried a nonzero value, so nothing could tell the two shapes apart. A capture with a nonzero one
  separates them outright: all 15 heroes on the account gain the SAME crit-damage percentage points
  over their birth roll, across rolls spanning 45.03 to 73.13 and levels 1 to 97. It is flat, like
  every other crit-damage term — the stat point and Golpe Brutal both already are.

  Charging it against the roll under-credited the tree on any hero whose crit-damage roll is below
  100, and point inference charged the unexplained residual to crit-damage points. On a level-97
  Bellatrix the tree was credited 5.54 of the 8.17 it actually gave, and the 2.64 left over became
  `2.64 / 5 = 0.53` — one phantom point, rounded up. Her Stats panel read 78.27% crit damage where
  the game exported 75.91%, and the point-reset panel offered 98 points to re-place on a hero that
  can only ever hold 97. With the shape corrected, every hero solves to a whole-number point vector
  with zero inference issues, each landing exactly on its level.

  Separately, and as defence in depth: the reset panel's budget is now clamped to the hero's level,
  so a bad point vector from anywhere upstream can no longer be sold as a respec proposal larger
  than the game allows. The optimizer's budget already carried this clamp; the reset tier, which is
  the one the panel actually shows, did not.

  And when a hero does hold more points than its level, both the Points panel and the team plan's
  point-reset table now say so, instead of quietly printing the impossible number. The Points
  panel's spent/level counter already turned red on this and explained nothing; the reset table
  showed an unclamped "before" against a clamped "after", so the reset appeared to destroy a point.
  The new line names the numbers, asks for a fresh save export — which fixes it whenever the cause
  was stale data — and points to Discord if it survives that. It is deliberately mute about which
  stat is wrong: the unexplained residual lands wherever the mis-attribution happens to fall, so
  naming one would send you chasing the symptom.

- Updated dependencies [8692c92]
  - @bombfarm/contracts@0.3.3

## 0.6.1

### Patch Changes

- 7772ae0: Correct the House recovery timers and give the Account its own page

  The `HOUSES` table was a whole-minute reconstruction and every endpoint was short of the real
  cycle — Casa I ran 19→17 min against a true 20→19, and Casa V ran 7→5 min against a true 11→10,
  nearly half the real recovery time. The wiki publishes the exact figures per house
  (`cycle_secs_base`/`cycle_secs_max`), and interpolating those reproduces a captured in-game
  countdown of 1168.42 s at Casa I level 11 to the rounded second, which the old table missed by
  91 s.

  Because House rest sets how much of a rotation is spent refilling rather than on the field, this
  moves every duty-cycle-derived number for anyone whose save did not carry its own `casa.cycle_secs`
  — sustained DPS, farm rate, clear time, the team-plan score, and the next-point ranking (a point
  of Energy is worth more against a longer cycle than it used to be). The per-house recovery-slot
  ladder is corrected from the same source: Casa II and Casa III were listed at 6 and 9 slots and
  are really 5 and 7.

  A second correction rides along: House level 0 (a house you have not unlocked) used to extrapolate
  BELOW the level-1 base, inventing a cycle longer than the house can ever have. The game reports the
  base for such a house, so the level is now clamped to 1..20.

  The Account panel becomes a page of its own at `/account`, reachable from the site nav, and leaves
  the planner's tab strip — the planner keeps Abilities, Gear and Points. It is rebuilt the way the
  Farm page is, as small focused sections instead of one long panel:

  - **A header** naming the account: player name, account ID, current phase and furthest phase. The
    first two come from `account.player_name` / `account.account_id`, which are optional export keys
    the app never read before; a save without them shows dashes rather than a blank header.
  - **A House section** with the current House and its level as `13 / 20`, its recovery cycle and
    recovery slots — and what the next House gives you at its own level 1, so the upgrade is a
    comparison rather than a guess.
  - **A Skill Tree section** mirroring the game's own Bonus summary, including the part the game
    leaves implicit: Total damage is not a third independent bonus, it is `(1 + squad damage) ×
multiplicative damage`, and the panel prints that working. Luck and the XP multiplier moved here,
    and field slots show both the tree's bonus and the usable total (they differ by exactly one).

  The farm-phase field, the target-prop picker and the team-buff fields are gone from the page along
  with the strings and components that served only them; the page is now entirely read-only,
  import-sourced facts. Note that a stored team-buffs override is still honoured by the farm-rate
  math — nothing can author a new one, so an account that set one before keeps it with no UI to
  change it.

- b1e2591: Fix field time under-counting for heroes with both a self and a team drain reduction

  Energy drain reduction from a hero's own Bateria Extra and from the team's Fôlego de Mineiro aura
  were combined multiplicatively — each caps at 20%, so a hero with both at max was treated as
  draining at 0.80 × 0.80 = 0.64 energy/s. Measurement shows the two reductions add instead: 1 −
  0.20 − 0.20 = 0.60 energy/s. A hero carrying both now shows about 6.7% more field time per
  deployment, and every planner number derived from it (sustained DPS, farm rate, clear time) moves
  with it. A hero with only one of the two reductions is unaffected.

- f2d6231: Farm Respec Advisor: name the hero an item is taken from, instead of calling it Inventory.

  When the plan sourced a piece off a hero scoped to Donate, the proposed-items card said
  "From Inventory" — the item was in fact still worn by that hero. The move list now reports the
  item's real wearer on both ends of the move, and pairs the equip with the unequip that has to
  happen first, so the checklist no longer asks you to equip a piece it never told you to remove.

- 635abe3: Add rotation status classification: field, recovering, queued, and benched

  `@bombfarm/domain` now exposes `classifyRotation`, which sorts a normalized `/rotation` snapshot's
  heroes into four lists — on the field, recovering at the house, queued for a house slot, and
  benched — plus an occupancy count and the house panel's read-only figures (active house level,
  slots, cycle time, rescues). Classification keys off each hero's own activity, never off whether
  the game currently has them parked at the house: a benched hero and a queued one can both sit at
  the house at the same time, so that flag alone cannot tell them apart. Each recovering hero also
  carries its own remaining recovery time, derived from the house's cycle length and how full its
  energy is.

  The rotation vocabulary also gains the fourth hero state the game reports — fully recovered and
  waiting for a field slot. It was previously unrecognised, which cost a hero its activity; it now
  reads as its own state and is listed alongside the heroes queued for a house slot.

- b1e2591: Keep per-hero rotation state, and stop a cosmetic shape change from blanking a whole account section

  The `/rotation` read used to keep only its `casa` (house) sub-object and discard the rest of the
  body — the field list and, most importantly, each hero's in-field/energy/recovery state, even
  though that state was already being validated. That data now reaches storage.

  Separately, any account section whose response shape drifted from what this app expects (a game
  update adding or removing a field) used to be dropped entirely for that cycle, even when the data
  that mattered was still there — a mismatch was correctly detected, but the section was then
  processed as if the source hadn't answered at all. A drifted section that still holds a usable body
  is now kept and reported as degraded (naming the keys that changed), rather than discarded. A
  section that lost the very data it needs still reports missing, unchanged.

- Updated dependencies [b1e2591]
- Updated dependencies [635abe3]
- Updated dependencies [b1e2591]
- Updated dependencies [b1e2591]
  - @bombfarm/contracts@0.3.2

## 0.6.0

### Minor Changes

- f5671be: Farm rate: scale the plant-to-plant hop distribution to each ato's prop density.

  `HOP_DISTRIBUTION` is measured on an ato-1 map (50 props) and was applied unchanged to every
  ato. Denser atos pack props closer, so a hero walks less between plants — applying the sparse
  histogram to a dense map over-predicts hop length and under-predicts throughput. Hop length now
  scales by `sqrt(props_ato1 / props_ato)`, identity at ato 1 and 0.816x at ato 2.

  Clear time falls on atos 2–5 and every rate derived from it rises: gold, chests, keys, gems,
  time pieces, stone chests and XP per hour. Ato 1 rows are unchanged. The effect grows with
  density — roughly 10% faster clears at ato 2 up to 25% at ato 5 — and is bounded, because the
  cycle is `max(fuse, hop/w)` and most of the histogram already sits under the fuse floor.

  Validated against live telemetry at phase 51 (ato 2), where the row moves from 1.15x off the
  measured gold/hr to 1.05x, and the new `farm-rate-486-ato2-anchor` suite pins it.

  Open residual and the blocked ato-2 anchor are tracked in issue #132.

- 5a742c9: Fixes three defects in the farm-rate throughput model. Against live telemetry on account 486 at
  phase 26 the estimator predicted 571,546 gold/hr where 371,263 was banked; it now predicts
  498,898 (−12.7%). Gold-per-prop was already correct (214.2 predicted, 216.6 observed) — the whole
  error was throughput. A residual ~1.34x remains and is deliberately left open: it belongs to the
  bomb-cadence term, which is held for a pending live capture. No cadence constant was touched.

  **The House recovery-slot ceiling is now modelled.** Every hero's `uptime` is its own duty cycle
  `F/(F+T)`, and the previous model simply summed those — which assumes the House recovers every
  hero in parallel. It does not: it refills `casa.slots` heroes at a time and the rest queue at
  frozen energy. Each hero occupies a recovery slot for `1 − uptime` of wall clock, so a roster's
  demand is `Σ (1 − uptime)`; account 486's 7 heroes ask for 5.31 slots against the 3 they own. The
  scarce slot-seconds are now allocated greedily by value density (props delivered per deployment),
  each hero capped at its own duty cycle — the strongest hero takes a slot ahead of a weaker one,
  as the real client does. That puts 1.3153 heroes on the field against a live-measured 1.317;
  uniform throttling would have said 1.03. The allocation is per-phase, because mitigation changes
  the ranking, and adds zero advisor-pipeline calls.

  **Rest seconds now come from the save.** `casa.cycle_secs` is parsed onto the account and
  preferred wherever rest time is needed; the `HOUSES` table (a whole-minute reconstruction, ~7.8%
  fast — 1077s against a measured 1168.42s at Casa I level 11) is now only the fallback for payloads
  that do not carry the key. This feeds `Context.restSeconds`, so it moves duty-cycle and sustained
  DPS numbers on the advisor and the team plan too, not only the farm board.

  **Field slots and House slots are no longer the same number.** `casa.slots` is the House's
  RECOVERY concurrency; the field concurrency cap is `skills.field_slots` (3 vs 6 on account 486).
  The farm board read the former as the latter, capping a 6-wide field at 3. Both are now parsed and
  carried separately, and the field cap is applied after the House ceiling rather than to the
  unconstrained uptime sum.

  API: `SquadFarmFacts` gains `houseSlots` and `houseSlotDemand` and loses `concurrencyScale`, which
  moves to `FarmRateRow` (now `min(1, fieldSlots / heroesOnField)`) alongside a new `heroesOnField`.
  `AccountImportData`, `AccountShared` and the web planner store gain `fieldSlots` and
  `houseCycleSecs`; `AdvisorPipelineInput` gains an optional `houseCycleSecs` and the team-plan farm
  context an optional `cycleSecs`. `resolveFieldSlots` (`@bombfarm/domain/casa-slots`) and
  `resolveHouseRestSeconds` (`@bombfarm/domain/model`) are new exports.

- dd793f0: Farm Ranking: price team auras over the rotation, and refit the per-ato hop density law

  The board's gold/hr ran high, and two independent terms were responsible.

  **Team auras were read off the deployed line-up.** `account.teamBuffs` is a snapshot of whoever is
  standing on the field at the instant a save is exported — the right quantity for the advisor and
  the team-plan scorer, which price one fixed line-up, and the wrong one for a board that cycles a
  whole pool through the House for hours. A carrier on the field 59% of the time had its full aura
  applied to 100% of every row; a carrier sitting in the pool but not deployed contributed nothing at
  all, even though it farms for a large share of every hour. The Farm Ranking board now derives the
  four combat auras from the enabled pool's own ability ranks weighted by each hero's uptime, so
  toggling a carrier out of the rotation pool correctly removes its aura too. Multiple carriers of
  the same aura are combined as an expectation over independent presence rather than as a capped sum,
  which stops two half-present carriers reading as one permanently present one. An explicit team-buff
  override still reaches the board verbatim — a hand-typed "assume this much aura" has no carriers
  behind it to weight.

  **Hop length was assumed to fall as the inverse square root of prop density.** A denser ato does put
  its props closer together, but not nearly as strongly as that geometry predicts. Refitting the
  density response against 632 attributed plant-to-plant hops gives an exponent of 0.124 (bootstrap
  95% CI [0.066, 0.158]), where 0.5 was being used; ato 2's plants sit 0.951x as far apart as ato 1's,
  not 0.816x. This was shortening modelled ato-2 clears by about 5%.

  Against 192 live clears of phase 51 the board's gold/hr moves from ~11.7% high to within 0.4%, and
  on a second, earlier capture of the same account the residual falls from -6.2% to +3.9%. Every
  per-hero and per-phase throughput figure the board prints moves, as do the Farm respec solver's
  proposals, which read the same rates.

- c6f077e: Adds a farm-objective optimizer to `@bombfarm/domain`: `solveFarmRespec` and `gateFarmRespec`
  (`@bombfarm/domain/farm-optimize`), the objective layer `@bombfarm/domain/farm-optimize-objective`,
  and a per-hero farm basis seam added to `@bombfarm/domain/farm-rate`.

  Given a roster, an account and an objective (gold/hr, chests/hr, or a weighted blend of both),
  the solver jointly picks a per-hero stat-point allocation and the phase to farm it at, coupling
  the two because the best build depends on which phase it is evaluated against and vice versa.
  It reports the proposed allocation for every enabled hero, the recommended phase, the gain over
  the player's current build, the in-game respec cost and the payback time in gold-earning hours.

  Two evaluation tiers ship, both with bounded, named, exported evaluation budgets so neither can
  run unbounded: a cheap always-on gate that reports a conservative lower bound on the available
  gain, and a fuller on-demand solve that also reports a cost frontier (the best single-hero and
  best two-hero respec, each re-solved on its own, not truncated from the joint answer) and a
  plateau report — the range of near-optimal energy allocations around the recommendation, since
  the true optimum is a broad flat region rather than a single sharp point.

  The solver never re-enters the advisor pipeline beyond the one call per enabled hero the estimator
  already makes: every candidate build's facts are reconstructed by pure scalar math from that one
  call, which is what keeps hundreds of candidate evaluations cheap. It is deterministic — two
  solves on equivalent inputs always agree, including on the plateau region and independent of
  hero-array ordering — and re-running it on its own recommendation is a fixed point: it reports
  nothing further to gain. Stat-point luck is never touched.

  Also extracts the per-level in-game stat-point respec cost (`1000 gold × level`) into one shared
  helper, `respecCostGold` (`@bombfarm/domain/respec-cost`), and switches the Team Plan waterfall's
  existing inline copy of that same rule over to it, with no change in the value it has always
  produced.

- 796ce3b: The planner's next-point ranking can now rank by what a point does for your farming rotation,
  not just raw damage. Farm mode scores each stat by the marginal change it makes to your rotation's
  gold or chests per hour, evaluated across your whole enabled roster at that build's best unlocked
  phase — the same objective the Farm page's respec advisor already uses. This is now the default
  for every account; if you'd already switched to DPS mode, that choice is kept exactly as you left
  it.

  The old one-shot mode is gone — its math (a hand-tuned bonus for reducing hits-to-kill on one
  chosen prop) is retired outright, not deprecated. A save that still had it selected loads on Farm
  mode automatically. The Account tab no longer asks you to pick a target prop before it will show
  next-point advice; that field still drives the hits-to-kill table below it, it just isn't required
  for ranking any more.

- 0418a82: Re-synced the planner against the 2026-08-15 game patch: new item catalog, a raised hero level
  ceiling, and — the load-bearing part — crit chance and cooldown reduction moving from
  multiplicative shares of the hero's roll to flat addends.

  **Crit chance and CDR are FLAT now.** Gear, sheet abilities, the skill tree and stat points all
  ADD to the birth roll instead of multiplying it:

  ```
  before:  sheet.critChance = birth.critChance × (1 + Σ gear + Σ ability + tree)
  after:   sheet.critChance = birth.critChance +  Σ gear + Σ ability + tree
  ```

  Measured on four post-patch save exports (account 486, 2026-08-16), residual 0 to floating point
  on every hero-instance, every point budget landing exactly on the hero's level. Each term is
  isolated by at least one hero: a hero with no items and no crit ability pins the tree term alone;
  two more add `olho_clinico` 20 on top; a deliberate respec of a naked L4 hero pins the per-point
  rates (`crit_chance` +0.00048788 on 2 points, residual 3.0e-18; `cooldown_reduction` +0.0007026,
  residual −1.1e-19) with no base-roll and no level scaling. Penetration, speed, luck and crit
  damage did **not** change shape.

  **The ITEM half is measured too**, on `save-20260816-5heroes-gear-cdr-crit.json`, and it is what
  rules out the tempting reading that a ~55x rescale of the wiki's crit and cooldown values was a
  rescale only. Every hero there wears gear rolling `crit` and/or `cooldown`, and every hero's
  `cooldown_reduction` delta is the plain SUM of its items' rolls to ≤3e-18, with no base-roll
  factor anywhere. The discriminator is model-free: any percent-of-base model has the form
  `Δ = birthRoll × f(gear, ability, tree)`, so two heroes with identical gear and ability must show
  deltas in the ratio of their rolls. Bellatrix and Jon (rolls 74% apart) and Minato and Doran
  (55% apart) each move by _identical_ amounts. No percent-of-base model of any coefficient fits.
  `packages/domain/tests/flat-crit-cdr-shape.test.ts` pins that argument, and goes red under a
  mutation of the shipped conversion.

  Consequences: `POINT_GAIN.critChancePctOfBase`/`cdrPctOfBase` become `critChanceFlat` (0.024394)
  and `cdrFlat` (0.03513); `GearBonuses.critPct`/`cdrPct` become `critFlatPct`/`cdrFlatPct` in
  planner percentage points; `SheetOtherPct.critChance`/`cdr` become `critChanceFlat`/`cdrFlat`
  alongside the existing `critDmgFlat`. `olho_clinico` is +0.04574 pp/rank and `pressagio_mortal`
  +0.06099 pp/rank. Both the crit-chance and cooldown reads in the planner's UI follow the new
  units: the gear-bonus table stops rescaling the two flat columns by 100 (a nv300 crit roll read
  "+744.0%" instead of "+7.4"), and the Presságio Mortal team-buff field is relabelled from
  "Crit % base" with a step of 1 to "Crit pp" with a step of 0.05, its full 20-rank range now being
  ~1.22. The Points-tab help text in both locales now describes crit chance and CDR as flat, which
  is the model actually shipped.

  A one-shot local-storage migration (`bf-hp-critchance-flat-migrated-v1`) replays existing rosters,
  mirroring the crit-damage one. It fires on **two** triggers, not one: an `olho_clinico` rank (the
  sheet-ability bake) _or_ a loadout carrying a crit or cooldown roll (the gear term, which changed
  shape for both stats and which cooldown — having no ability at all — is only reachable through).
  Gating on the ability alone would leave every rank-0 hero wearing cooldown gear stale forever, and
  cooldown leads the pants slot after the 2026-08-16 redistribution.

  **Items:** levels now run 10…300 in steps of 10 with exactly one set per level (30 sets, 240
  definitions), including three new top-end sets — Obsidiana (nv280), Magma (nv290), Vazio (nv300).
  Every set above nv90 was re-keyed to a new native level by the game. Catalog v4's
  percentage-of-Attack Dano regime is **gone**: `DMG_PCT_MIN_LEVEL` and `isDmgPctLevel` are removed
  and `scaledValores` returns flat Dano at every level. `composeAttack`/`decomposeAttack` keep their
  signatures and stay exact inverses.

  **Hero level ceiling:** new `HERO_MAX_LEVEL` (500) exported from `@bombfarm/domain/model`, used by
  `canLevelUp`, `nextLevelStep` and the planner's level clamps. `levelPowerMult` is unchanged — the
  game's own curve still reports `1 + 0.04 × (level − 1)` at level 500.

- 4fcaa1a: Reverts crit chance and cooldown reduction back to percent-of-base, undoing the flat-addend model
  `crit-damage-is-flat.md`/`game-update-20260815-catalog.md` shipped three days earlier. The
  2026-08-15 patch moved both stats to flat addends; the 2026-08-18 patch put them straight back:

  ```
  before (08-15..08-18): sheet.critChance = birth.critChance +  Σ gear + Σ ability + tree
  after  (08-18 onward):  sheet.critChance = birth.critChance × (1 + Σ gear + Σ ability + tree)
  ```

  Crit **damage** did not move either time — it stays the flat model from the 2026-08-13 patch,
  untouched by this change.

  **Measured on two 2026-08-19 captures** (account 486): a 12-hero export and, 2 hours later, the
  same roster after a deliberate 10-point respec on one naked hero. That respec is the anchor —
  `n_crit × 0.02 = 0.1`, `n_cdr × 0.02 = 0.1`, `n_crit + n_cdr = 10` — which the capture alone can't
  fully disambiguate (any integer split from (1,9) to (9,1) fits), so the wiki table's independently
  published `r_crit = r_cdr = 0.02` breaks the tie; the respec then confirms both rates exactly, with
  no base-roll or level term left over. `POINT_GAIN.critChancePctOfBase` round-trips to its old
  pre-08-15 value (0.02) exactly; `POINT_GAIN.cdrPctOfBase` does **not** — it lands at 0.02, half its
  old pre-08-15 value of 0.1, not a full round-trip. Worth flagging plainly since crit chance's rate
  did round-trip and the asymmetry reads like a typo otherwise.

  **Item catalog**: `statBase.crit` and `statBase.cooldown` (and every def's rolled `crit`/
  `cooldown` value) are rescaled ×40/7, from `0.00112704`/`0.00098361` to `0.00644023`/`0.00936771`
  — the exact inverse of the 08-15 patch's rescale in the other direction. Every other `statBase`
  value, every set/def structure, the level ladder, and the 2026-08-16 stat redistribution are
  untouched; this is a value-only rescale of two stats across the existing structure.

  **Abilities**: `olho_clinico` (Olho Clínico) is `+4.285714285714286%` crit chance per rank, `% of
base` — measured directly, rank-20 residual 0 against the exact `6/7` fraction. `pressagio_mortal`
  (Presságio Mortal) is `+5.714285714285714%` TEAM crit chance per rank — the same ×40/7 rescale
  applied to its own pre-08-15 value, but **published, not measured**: no capture, before or after
  either patch, has ever included a hero who owns this ability, so nothing confirms it directly. Two
  unrelated crit-chance sources (an on-sheet ability and the item base) landing on the identical
  rescale factor is what makes the published value credible, not a cross-kind guess by itself.

  **`reoptBudget` now clamps to hero level unconditionally** (`packages/domain/src/points-reopt-core.ts`).
  It previously floored at `level - pts.luck` without an upper clamp, so a bad upstream `pts` vector
  (from `inferSpentPoints` or elsewhere) could hand the respec search several times a hero's real
  budget: on a level-69 hero the unclamped floor produced a 210-point budget, and the advisor sold a
  +18.9% gold/hr respec for 429,000 gold with 0% of that gain achievable — 101% phantom. Clamping
  removes the amplifier; `tests/points-within-level-budget.test.ts` remains the guard that should go
  red first if a `pts` vector ever overshoots `level` upstream. This narrows the farm-respec advisor's
  proposed gains across the board, independent of the crit/CDR shape change above.

  **What moves in the planner**: any hero with crit-chance or cooldown gear, ability ranks, tree
  points, or spent stat points gets a different sheet value under the restored pooled formula, and
  every derived figure downstream (crit factor, DPS, farm-rate estimates, next-point rankings) shifts
  with it. The account-486/phase-26 farm-rate anchor moves from 365,087 to 364,417 gold/hour
  (clear time 105.62s → 105.81s) — expected, since it is downstream of `critFactor`.

  **Local data migration.** A hero saved between 2026-08-15 and 2026-08-18 has its
  `naked.critChance` baked under the flat model; read directly under the restored pooled model it
  would show the wrong Birth roll. A new one-shot migration
  (`bf-hp-critcdr-repool-migrated-v1`) converts each affected hero's stored value back to a
  percent-of-base roll the first time the planner loads after this update, mirroring the existing
  crit-damage and crit-chance migrations. It also drops any stale `gearedOverride` the same way those
  migrations do. Runs automatically; nothing to do.

  **Fixture corpus**: adds two 2026-08-19 captures (a 12-hero export and its 10-point respec) as the
  new sheet-math anchor and the point-rate witness for both rates. `save-20260816-5heroes-gear-cdr-crit.json`,
  `save-20260816-9heroes-redistrib.json`, and `save-20260817-11heroes.json` are retired from the
  level-budget invariant as non-subjects — they capture the three-day flat-addend window and no
  current model reproduces both them and the post-08-18 game. `flat-crit-cdr-shape.test.ts` is
  inverted from a flat-shape sensor into a percent-of-base shape sensor over the new captures.

- 3e2cf46: Adds the farm-rate estimation module for Phase Farm Ranking (`@bombfarm/domain/farm-rate`):
  `computeHeroFarmFacts`, `computeSquadFarmFacts`, `computeFarmRateRow`, `computeFarmRateTable`,
  `computeFarmRates`, `returnBonusMultiplier`, plus the `E_D_CELLS` / `FORTUNA_AURA_CAP` constants
  and the `HeroFarmFacts` / `SquadFarmFacts` / `FarmRateRow` / `FarmRateOptions` / `FarmFactsInput` /
  `ReturnBonusMode` types. Turns a roster and account into expected gold/hr, chests/hr, keys/hr
  (signed), gems/hr, time-pieces/hr, XP/hr, clear time and jaula facts for all 600 wiki phases —
  zero advisor-pipeline calls per phase, one call per enabled hero.

  `GRID_SPEED_COEF` and `EFF_IA` are promoted from module-private to exported on
  `@bombfarm/domain/model`.

  `account.max_phase` is now parsed on import (`account.max_phase` primary, `skills.max_phase`
  fallback, normalized to an integer in `[1, 600]` or `null`), surfaced as
  `AccountImportData.maxPhase` (required) and mirrored as an optional `AccountShared.maxPhase`.

  Corrects two stale ability effect texts that mismatched the live wiki API: `veia_ouro` reads
  `+2%/level (self), +40% at cap` (was `+4%/level`), and `fortuna` reads `+0.5%/level (team aura),
+10% at cap` (was `+2%/level, +40% at cap`) — in both `model/abilities.ts` and `game-labels.ts`,
  English and Portuguese. Both keep `effect: { kind: 'none' }`; no combat modifier changes.

- 3e2cf46: Re-synced the committed phase wiki bundle (`packages/domain/src/data/phase-wiki.json`) against
  a fresh wiki pull, and it corrects tables the game had already moved out from under a
  2026-08-03 export:

  - **Phase gold (`goldComum`)** is about **25% lower** across all 600 phases (the game's own
    data, not a game-side nerf being applied here — the committed bundle was simply stale).
  - **XP per prop** now starts at 18 and ends at 1800 for phase 600 (was 3 / 300 — roughly 6x
    higher across the curve).
  - **Item-level drop bands** and **hero-chest rarity by difficulty** (act 3, 4, 5) are re-cut to
    match the live tables.

  New constants, previously absent from the bundle entirely:

  - Chest / key / gem-chest / time-chest drop rates, the gate key cost, and the Return Bonus pair
    (`DROP_RATES`, `KEY_GATE_COST`, `RETURN_BONUS_ADD`, `RETURN_BONUS_ADD_VIP`,
    `RETURN_BONUS_CAP_SECS`)
  - Time-chest rarity by difficulty (`TIMECHEST_RARITY_BY_ATO`)
  - The gem catalog, gem rank distribution by difficulty, and gem chest drop rate
    (`WIKI_GEMS`, `GEM_RANK_DIST_BY_ATO`, `GEM_LIST`)
  - The three loot-affecting ability values — `veia_ouro`, `fortuna`, `olho_lapidador`
    (`LOOT_ABILITY_VALUES`)
  - Two new freshness stamps, `WIKI_SOURCE_PULLED_AT` (the wiki pull date) and `WIKI_EMITTED_AT`
    (the bundle build date) — `WIKI_SYNCED_AT` now always reflects the pull date, never the emit
    date.

  **Breaking (internal, within `@bombfarm/domain` only — no consumer shipped yet):** `JAULA`'s
  shape changed. The game's cage mechanic no longer has a per-phase early-arrival ramp or a
  per-difficulty guaranteed window; the wiki now reports a flat per-difficulty early-arrival
  probability and a single guaranteed window (VIP and non-VIP). `JAULA` is now
  `{ adiantaProbPorAto, janelaSecs, janelaSecsVip, hpMult }`. `jaulaEarlyCap(phase)` keeps its
  name and signature — it now looks up the difficulty's flat probability instead of interpolating
  a ramp that no longer exists in the data.

  Every other export keeps its name and signature. No formula changed — this is a data refresh
  and a new set of typed constants; the math that reads them ships separately.

- c8a3bc8: The Phases board's Economy panel was showing XP per prop straight from the wiki, with no account
  boost applied — every other "yours" figure on that panel (gold included) already scales with your
  account, XP just didn't. It now reads a wiki/yours pair, same as gold: "yours" is the wiki value
  times your account's XP multiplier (`skills.totals.xp_mult` from your save).

  There's also a new **Drops** panel on the Phases board, showing each drop chance the game's own
  tooltip shows at that phase — item/hero chest, ready key, time chest, gem chest, stone chest —
  each as a wiki/yours pair, filtered to only the drops that actually roll on that phase (a gate
  phase shows chest + time + gem + stone; a non-gate phase shows chest + key). "Yours" is the wiki
  rate times `(1 + your on-field squad's average luck)`, reconciled against two live in-game
  tooltips.

  The Account import summary now also shows your account's XP multiplier alongside the existing
  team-coin percentage.

  The Farm Ranking board's per-phase estimate had the same two gaps, in its own separate
  computation: its XP/hr column didn't carry your account's XP multiplier either, and it modelled
  four of the five drop kinds, with no stone-chest term. XP/hr now scales the same way gold/hr
  already does, and the estimate now also accounts for stone chests on gate phases, at the same
  rate as gem chests — not yet surfaced as its own board column.

- 4fcaa1a: Fixes five compounding errors in the team-aura model, confirmed against the maintainer's own
  roster: **a team aura is a property of the FIELD, not of any one hero.** Every deployed hero —
  carrier or not — experiences `min(cap, Σ every carrier's rank)`. Two rank-20 Fôlego de Mineiro
  carriers give −20%, two rank-10 carriers give the same −20%, and a non-carrier standing next to a
  rank-20 carrier also reads −20% — never −40%, never −20%×2, and never 0% just because it happens
  to be a non-carrier.

  **Contra o Relógio was never a team aura.** The wiki's `kind` prefix (`gate_power`, not the
  `team_*` every genuine aura carries), its own "Só ele" scope column, and this catalog's
  `effectText` (missing the "do TIME" every real aura has) all agree it is self-scoped — a hero's
  own gate-phase attack bonus, not a team-wide one. It is removed from `TEAM_BUFF_ABILITY_IDS` /
  `TEAM_BUFF_FIELDS` / `zeroTeamBuffs()`; `gateAttackMult` reads the hero's own ability ranks alone.
  This was a live double-count reaching the shipped gate advisor, not an inert modelling gap. A
  stored roster's `teamBuffs` blob may still carry an old `contra_relogio` key — it is a loose
  `Record<string, number>`, so the orphaned key is read harmlessly and never again.

  **A hero's own rank was double-counted against the team total.** `abilityMods` used to fold a
  hero's own Grito de Guerra / Marcha Acelerada / Fôlego de Mineiro / Presságio Mortal rank into its
  own combat mods, and the team's total was then stacked on top — so a carrier's own investment
  counted twice once any other carrier was on the field. `abilityMods` no longer touches any of the
  four team auras at all: they are accounted for ENTIRELY through the roster-wide total, which
  already includes every carrier, this hero included. The four abilities that share an effect kind
  with a genuine self ability (Fôlego/Bateria Extra on `drainPct`, Presságio/Olho Clínico on
  `critChancePctOfBase`) now split cleanly on ability id/`onSheet`, not on a shared, pre-folded
  multiplier.

  **`computeTeamBuffsFromDeployed` used to exclude one hero, so the total every OTHER hero read
  depended on who that was.** With one rank-20 carrier, excluding it left every other hero reading
  0% where the rule gives 20% — a UI-state-dependent answer to a question that has nothing to do
  with UI state. It no longer takes an `excludeHeroId`: it sums every deployed hero, excluding
  nobody, and returns the RAW total (the cap applies once, at the combination site
  `computeCombatMults`, so the stored/displayed figure can still show a true over-cap sum). The
  planner's hero editor needed the old exclusion to make a live rank edit move that hero's own DPS
  preview; it now gets the same effect from `substituteHeroAbilities(total, oldRank, newRank)` —
  substituting the edited hero's own contribution into the stored total instead of ever excluding it.

  **The cap was global and five times too generous.** The old cap clamped every aura at a single
  +100% figure attributed to a `combate.team_mult_bonus_cap` wiki key that does not exist — not in
  the live wiki payload, not in this repo's own drift capture. The real cap is per ability
  (`TEAM_BUFF_CAP`): Grito de Guerra and Fôlego de Mineiro cap at 20, Marcha Acelerada at 3.7,
  Presságio Mortal at 114.28571428571428 — each ability's own rank-20 maximum, not a shared
  constant. Five fielded rank-20 Fôlego carriers used to drive drain to a 100×-optimistic floor;
  they now cap at one carrier's worth.

  **The roster-wide total is now DERIVED by default, not a stored field starting at zero.** Once
  `abilityMods` stopped folding a hero's own rank into its own mods (above), the account's
  `teamBuffs` value became the ONLY source of any team-aura benefit — and that value defaulted to
  an all-zero `zeroTeamBuffs()` that nothing populated on import. A carrier's aura genuinely applied
  to nobody, including itself, until a user found the Account panel's auto-fill button by hand: a
  regression in shipped default behavior, not a modelling nuance. The farm board and the live
  advisor preview now read `computeTeamBuffsFromDeployed(heroes)` — the same pure roster total the
  auto-fill button always wrote — whenever the account carries no explicit override, so a fresh
  import shows the real total its own roster carries. The Account panel's manual fields remain a
  genuine override: editing one, or pressing Reset (an explicit all-zero override, distinct from no
  override at all), still pins the account to that exact figure regardless of later roster changes,
  exactly as before. A pre-existing local save's stored `teamBuffs` migrates on next load: an
  all-zero value (the old ubiquitous, never-touched default) is indistinguishable from "never
  touched" and becomes derive-by-default; any value with a genuinely nonzero entry was a real
  auto-fill snapshot or hand edit and carries forward as an explicit override, unchanged.

  **The desktop app had the same regression, with no button to work around it.** It has no
  team-buffs UI at all, so `AccountShared.teamBuffs` there was hardcoded to `zeroTeamBuffs()` as a
  placeholder for a dimension it did not model — harmless while a hero's own rank still self-applied
  regardless of that placeholder, but not once the self-fold above was removed: every desktop hero,
  including a carrier itself, started reading zero team-aura benefit with no way to correct it. The
  desktop's advice pipeline now derives the same `computeTeamBuffsFromDeployed(heroes)` total from
  its own roster on every rebuild — always derived, no override, since there is nothing on the
  desktop for an override to record.

  **Internal (no shipped behavior change): the account-486 throughput anchor is retired.**
  `farm-rate-486-anchor.test.ts` pinned `goldPerHour` against telemetry captured beside a save that
  predates both the 2026-08-15 crit-chance/CDR shape change and the 2026-08-16 item-slot
  redistribution — sheet math this repo already declares unreproducible
  (`points-within-level-budget.test.ts`'s `NON_CURRENT_REGIME_CAPTURES`). Re-pinning it to whatever
  this fix's model now produces would have anchored a fresh-looking number to a stale target, so the
  file is deleted rather than recalibrated (issue #137); its fixture stays committed for the
  structural suites that still read it for roster shape. A new in-regime anchor,
  `farm-rate-phase51-ato2-anchor.test.ts`, pins the same link-by-link chain against a post-revert
  capture (`sheet-math/save-20260818-12heroes.json`, phase 51) and 61 freshly-logged clears; its
  `heroesOnField`/`clearSecs`/`goldPerHour` carry a documented, left-open ~6-8% residual attributed
  to partial team-aura coverage across a farming rotation (issue #138) rather than tuned away.

  **What moves in the planner**: any roster with two or more carriers of the same team aura sees a
  lower (correctly capped) bonus than before; a non-carrier standing with a carrier now correctly
  receives the SAME bonus the carrier does, where it previously received none. A fresh import, or
  any account that never pressed auto-fill or edited a team-buff field by hand, now shows its
  roster's real team-aura total immediately instead of a blank zero panel. A roster with at most one
  total carrier per aura, no Contra o Relógio contribution to the gate advisor, and an explicit
  account-level override already on file, is unaffected in shape.

### Patch Changes

- 5025de1: Reworks the Phases explorer's Cage panel and corrects its stale VIP guarantee window.

  The section header drops the "(hero clock)" / "(relógio de herói)" suffix down to just "Cage" /
  "Jaula", and the panel now shows the bundled cage art centered under the title, with a short
  description underneath explaining how the cage's early-arrival chance works — replacing a tooltip
  that only lived on the early-arrival row's label. That row is reworded to "Early-arrival chance at
  this phase" now that the explanation moved into the panel description rather than a hover.

  The Guarantee window row now shows the VIP window (3h) as muted subtext under the normal window
  (3h 30m), sourced from `PhaseIntelGlobal.jaulaWindowVipSecs`, a new field wired straight off
  `JAULA.janelaSecsVip` alongside the existing `jaulaWindowSecs`.

  **The committed wiki bundle's VIP window was stale.** `phase-wiki.json`'s `janelaSecsVip` read
  9900 (2h45m); the live wiki reports 10800 (3h). Corrected as a targeted key fix, not a full
  re-sync — every other bundled value and the bundle's sync timestamps are untouched.

- 3d0d97b: Fix the Farm page printing two different clear times for the same phase

  The squad panel's "Est. clear time" and the ranking board's "Clear time" column were two
  independent models rendered side by side. The panel divided total map HP by the squad's summed
  sustained DPS, which credits the overkill a killing blow wastes; the board charges whole hits per
  prop (`ceil(propHp / avgHit)`) and adds the gate boss. On the phase-51 anchor roster the panel
  read 52.6s against the board's 83.8s and a measured 85.9s — 39% fast.

  The panel now reads the board's own row for the selected phase, so both surfaces print one
  number. `estimateClearSeconds` is removed from `@bombfarm/domain/phase-intel`; it had no other
  caller. The panel's tooltip is rewritten to describe the model that now backs it.

- 5770a5e: Fixes crit damage: it is **flat-additive**, not a percentage of the hero's crit-damage roll. Both
  the sheet ability and the stat point were modelled as shares of the roll; both are flat, and the
  error was large enough to make the planner invent points a hero cannot hold.

  - **Golpe Brutal** grants **+4 crit-damage percentage points per level**, flat — not 4% of the
    roll. Ivo (id `21076`, L38, 20/20, zero unspent points) moves from `birth_stats.crit_dmg`
    1.45238210566148 to `stats.crit_dmg` 2.25238210566148: exactly `+0.8 = 20 x 0.04`.
  - **A crit-damage stat point** grants **+5 percentage points**, flat — not 8% of the roll. Two
    heroes with different rolls, each holding exactly 2 such points, move their sheets by the same
    +10.0: Bellatrix L42 off a roll of 66.252971472748, and a second hero off 67.127583786901. A
    share of the roll would have to produce two different deltas.

  **Why heroes were showing impossible builds.** A hero is granted one stat point per level, so its
  spend can never exceed its level. Modelling Golpe Brutal as percent-of-base left an unexplained
  residual on the crit-damage line, and point inference charged it to spent points: Ivo came out at
  **50 points on a level-38 hero**, all 12 of the excess in crit damage. The respec advisor budgets
  off that number, so it would have proposed a 50-point build for a hero that can hold 38 —
  unbuildable advice. Both now reconcile exactly.

  **Also fixed by the same change**: Bellatrix L42's long-standing crit-damage inference issue,
  previously documented as an unresolvable "known inference ambiguity" in the fixture corpus. It was
  this unit error; she now solves to exactly 2 crit-damage points, and every hero in every committed
  capture is inference-issue-free.

  What moves in the planner: any hero holding crit-damage points has a slightly different crit-damage
  sheet value (now matching the game's own export exactly), and the marginal value of a crit-damage
  point changes for every hero — it rises for heroes whose roll is below 62.5 and falls for those
  above, since the gain no longer scales with the roll. Next-point rankings, the crit-damage stat
  breakdown and DPS figures shift accordingly.

  **Historical note, for anyone comparing against older captures**: crit damage genuinely WAS a
  percentage of the roll before the 2026-08-13 patch, and the old model fit those saves exactly. The
  patch changed the shape; every capture since is flat.

  **Local data migration.** If you already have a hero saved with Golpe Brutal spent, its stored
  crit-damage sheet value was baked under the old (multiplicative) model and would otherwise be
  misread under the new (flat) one — the Stats panel's Birth column would show the wrong roll, and
  setting Golpe Brutal back to 0 would silently rewrite the misread value into storage. The web
  planner now runs a one-time, one-shot conversion on your existing local roster the first time you
  open it after this update: it recovers each hero's original roll from the old bake and re-bakes it
  under the new flat model, so the sheet keeps showing the same hero you already had. Heroes without
  Golpe Brutal are untouched. This runs automatically; there is nothing to do.

- ab1c1b9: Shows each drop's in-game chest next to its label in the phase **Drop chances** panel, drawn at
  the difficulty of the phase being viewed.

  The panel named five drops in text alone, and its rows came in wiki/yours pairs, so a gate phase
  printed eight nearly identical lines that differed only by wording and a three-decimal percentage.
  An icon is how players tell these apart in the game, and it is what makes a row findable without
  reading it. Those pairs are merged into one row each further down, which is what makes room to
  draw the art at a size worth reading.

  **Every row shows the chest the drop actually arrives in**, except the ready key — a key is not
  delivered in a chest, so that row shows the key itself. Four of the five are difficulty-scaled,
  matching the art the game files per band and the colour language players already read (green at
  Fácil through red at Inferno). The mapping is the game's own, not an invention:

  - `key` → the gate key of that band's rarity. The band→rarity step is the same `1..5` the planner
    already applies in `GATE_KEY_RARITY_INDEX`.
  - `time` → the House of that band. A time chest pays out house parts, so the game files its stash
    icon as the house itself rather than as a chest.
  - `stone` → the skill-stone chest of that band.
  - `gem` → the gem chest of that band.
  - `chest` → fixed, and deliberately so: an item chest's grade follows the MAP LEVEL it drops at,
    not the difficulty, so tinting it by band would assert a relationship the game does not have.
    It uses the neutral wooden sprite the game's own item-chest icon constant points at, which
    reads as "this one is not difficulty-scaled".

  `dropIconSrc(dropId, ato)` in `@bombfarm/domain`'s `wiki-assets` builds those paths, clamping an
  out-of-range or non-finite band rather than composing a path to nothing. A `DropIcon` component in
  the web planner's `game-art` set renders it inside the existing label cell, adding no row to the
  panel, and decorative (`alt=""`, `aria-hidden`) since the label remains the accessible text.

  `StatListItem` gains an optional **`icon`**, rendered as a sibling of the label rather than inside
  it. That distinction is the whole fix, and both halves of it were measured in the browser rather
  than assumed:

  - A label carrying a `tip` _becomes_ the tooltip trigger, so art folded into the label lands
    inside that trigger — taking the trigger's dotted underline under the sprite as well as the
    words, and widening the hover target past the text it belongs to.
  - Folded in, the rows also grew 31px → 35px. As a sibling of the label they took their pre-icon
    height back exactly. (The row merge below then grows them deliberately, to 47px, which is a
    different decision made for a different reason.)

  21 newly bundled sprites under `public/wiki-assets/` — four per-band families of five, plus the
  one fixed item chest. All but the gem chests are byte-identical mirrors of what the wiki serves at
  the same subpath, matching how the existing `env/` and `icons/` art is carried; the wiki does not
  publish gem-chest art in any form, so those five come from the game client, and the
  `WIKI_ASSETS_BASE` doc names that exception rather than leaving the directory's provenance
  overstated. A forward-only guard resolves all 21 paths through `dropIconSrc` and asserts each file
  is on disk — every band, not just one, because a per-band family can be correct at ato 1 and dead
  at ato 4.

  No drop math changed: the same wiki and yours figures are computed and formatted as before — the
  change is which of them a row leads with, and how many rows it takes to say it.

  **The wiki/yours row PAIRS are merged into one row per figure**, in both the Drops panel and
  Economy. Each row now leads with the boosted total and carries the wiki base and the boost that
  produced it as subtext — `0.117%` over `0.100% +17% sorte`. The pair stated both numbers but left
  the reader to divide one by the other to see the boost at all, and it cost two rows per figure:
  eight on a gate phase's Drops panel, differing only by a parenthesised word.

  - A row with no boost prints the bare total and no subtext. With no save imported every multiplier
    is 1, and `0.100% +0% luck` restates the total while implying a boost that is not there.
  - Economy's XP row merges on the same terms, so the panel does not mix both shapes, and its three
    gold rows move the coin from the value to the label — the coin marks what the ROW is about, so
    it belongs with the row's name. A new `GoldIcon` does that; `GoldValue` is untouched and still
    prefixes coins to inline figures in the four other surfaces that use it.
  - The merge is what pays for `size-8` (32px) drop art, up from 14px. A gate phase prints four rows
    where it printed eight, and the panel's height comes from the board grid rather than its
    content. Measured: rows go to 47px, the list fills 181px of the panel's 405px, and the panel
    does not move. The taller row also absorbs the subtext line for free.

  Every merged label drops its `(wiki)`/`(yours)` suffix, so ten drop keys and eight economy keys are
  replaced by nine single-label keys plus three naming the boost SOURCE (`luck`, `team coin`,
  `XP mult`). `phasesXpPerProp` is revived at the frozen fixture's own value, so it leaves
  `KEYS_REMOVED` rather than becoming a declared delta.

  The account-486 live-tooltip witness is preserved through the change rather than relaxed: the
  tests read the two lines back out of the value node and still assert `167 -> 261` and `194 -> 303`
  for XP, and the four gate drop totals, as numbers.

  **The bundled drop sprites are renamed on the way in, to English difficulty words.** Upstream
  files the five bands inconsistently — bare indices on some families (`chest_skill_1`…`_5`,
  `house_house_1`…`_5`) and Portuguese words on others, two of them misspelled (`dificio`,
  `muitodificio`, for _difícil_ / _muito difícil_). Neither form belongs in this tree: an index
  leaves a reader decoding `_4`, and the misspellings would carry another project's typos into a
  public repository. They are now `chests/gem_chest_very_hard.png`,
  `chests/skill_stone_chest_easy.png`, `houses/house_inferno.png` and so on, off one
  `DIFFICULTY_SLUG` table taken from `GAME_DIFFICULTY_EN`. The meaningless `steam/` directory and
  the doubled `house_house` are gone with it, and `icons/chest_0.png` is now `chests/item_chest.png`.

  Renaming costs the property that a local path tells you where the file came from, so
  `docs/bundled-art-provenance.md` records the upstream path for each one — that table, not the
  directory listing, is what a refresh has to be driven from. The guard sweeps all 21 paths across
  every band, and is sharper than the equivalent prop sweep for the same reason: these names are
  this repo's own, so nothing upstream would ever disagree with a typo in one.

  Gate keys are deliberately left filed by rarity (`key/key_mythic.png`, not `key_inferno`): the art
  IS the rarity's key, and the band→rarity step belongs in `GATE_KEY_RARITY_INDEX` where it is
  visible, not buried in a filename.

  **The boost tooltip moves off the label and onto the subtext, and the drop-chance breakdown gains
  its missing skill-tree term.** Two follow-on fixes to the merged row above:

  - The label stopped being the tooltip trigger. With the boosted total and its breakdown already
    printed on the row, hovering the plain word "Item chest" to learn what boosted it was one
    interaction too many — the arithmetic is the thing worth explaining, so the dotted underline
    moves onto the subtext line itself (`TipLabel` now wraps the subtext, not the label). The three
    now-unused `phasesBoost*` strings (`luck`/`team coin`/`XP mult`) are removed with it — the
    trailing source word they supplied is gone from the subtext, which now reads `167 + 56%` and
    `0.100% + 17%` rather than `167 +56% mult. XP`. The three surviving hint strings say "base
    value" in place of "Wiki": the merged row already prints the wiki number inline, so naming it a
    second time in the tooltip was the confusing name, not the helpful one.
  - **Drop chances decompose into base + skill-tree Sorte + squad Sorte**, in that order, matching
    the order the tooltip explains them in — `0.100% + 20% + 5%`. `farm-rate.ts` already tracks
    these as two separate quantities (`treeLuckFlatPct` and the uptime-weighted `heroLuckPct`,
    peeled apart specifically so the tree's flat add is never double-counted); `phase-intel.ts`
    previously only accepted the pre-collapsed sum. `PhaseIntelGlobalOptions` gains
    `treeLuckFlatPct`/`squadLuckPct` as pure DISPLAY echoes — they do not feed `dropChances[].actual`,
    which stays driven by `luckFraction` alone, so every existing caller and the account-486 witness
    keep working unchanged. `phases-explorer.tsx` derives `squadLuckPct` as
    `luckFraction * 100 - treeLuckFlatPct` rather than re-averaging independently, so the two terms
    sum to the combined figure by construction. `dropItems` falls back to a single combined term
    when a caller does not supply the split (both default to `0`), rather than inventing a two-way
    divide it was never given — this is the path the account-486 witness test still exercises,
    since that witness only ever measured the two heroes' combined average, not a tree/squad
    breakdown.

  Gold and XP get the same subtext-tooltip treatment but **stay single-term** — `167 + 56%`, not a
  fabricated split. Both were checked against `farm-rate.ts` before assuming a squad share existed:
  `teamCoinMult` and `xpMult` are read straight off `account.tree` with no per-hero averaging
  anywhere in the pipeline, so the model genuinely has only one contributing source for either
  figure. `avgGold`/`mapGold` gain a tooltip they never had (`phasesGoldActualHint`, same as the
  `gold` row they share their math with) as a small, deliberate side effect of unifying every
  boosted row on the same subtext-tooltip shape rather than keeping one row an exception.

  **The English Drop-chances hint said "Sorte" instead of "luck".** The drop-chance boost
  breakdown above shipped with `phasesDropActualHint`'s EN copy reading "your skill tree's Sorte" —
  Portuguese leaking into the English namespace block, against this repo's own established
  convention (`stats.ts`'s `luck: "Luck"`, `gear.ts`'s `sorte: "Luck"`). Reworded to "your skill
  tree's luck" / "your squad's average luck"; the PT block, which correctly says "Sorte", is
  untouched. Four code comments in `phases-explorer.tsx` and `phase-fact-items.tsx` that said
  "Sorte" in prose are aligned to "luck" for the same reason, at no material cost to the diff.

  **The Drops panel always shows all five drop rows now, marked by phase type, instead of hiding
  the ones that cannot roll here.** A gate phase used to print 4 rows and a normal phase 2 — a
  reader comparing two phases side by side saw a different-shaped panel each time, and the layout
  math (`docs/`, `panel-field.recipe.ts`) never accounted for a row COUNT that could grow again
  later. Every row is now emitted in the fixed `chest, key, time, gem, stone` order regardless of
  phase type; a row that cannot roll on the phase being viewed is dimmed (`StatListItem` gains an
  optional `muted`, rendered as `opacity-45` on the row) and its value replaced by a dash plus a
  small note naming which phase type it IS specific to (`phasesDropGateOnly` for the three
  gate-only chests, `phasesDropNonGateOnly` for the ready key) rather than a live percentage.

  That last choice — dash, not a computed number — is deliberate: `row.actual` is still a real
  number for a drop that cannot roll here (the domain math does not gate it), but printing it next
  to a chest icon reads as "this can happen," which is false. A dash next to a dimmed, marked row
  reads as "not here" without inventing new UI vocabulary. `dropAppliesOnPhase` in
  `packages/domain/src/phase-wiki.ts` remains the one place that decides gate vs. non-gate; the
  panel only reads `DropChanceRow.applies`, never re-derives it.

  Measured in the browser on both phase types (map 1-1, non-gate, and map 1-10, a gate): the row
  count is 5 either way, the row list is 228px tall (was 181px at 4 rows), and the panel itself
  stays at 404.8px — byte-identical between the two phases and unchanged from before this PR, since
  its height still comes from the board grid rather than its content.

  **Final copy pass.** The key row is labelled just "Key" / "Chave" — "Ready key" carried the game's
  internal `keyDropRate` phrasing into the UI, where the qualifier says nothing a player needs. And
  the gate/non-gate sentence moves out of the per-row boost tooltip into the panel's section
  description: it describes the whole panel rather than any one row's arithmetic, so repeating it in
  every row's tooltip made the tooltip say two unrelated things and hid a panel-level fact behind a
  hover. It uses the same `tipClass` the Hero panel's section description already uses.

- 54fcaa3: Drops the item set selector from the gear slot editor — the level already determines the set.

  Each slot showed four selects: level, set, rarity, forge. The set select was dead UI:
  `catalog.setsByLevel` is a bijection (30 native levels, 30 sets, every entry a single-element
  array), so it could only ever render one option. Picking a level had already picked the set.

  - **The set select is gone**, and the set name moved into the level option's own label:
    `Level 300` + `Void` becomes `Level 300 - Void`, `Nível 300` + `Vazio` becomes
    `Nível 300 - Vazio`. That is one less control per slot across all eight slots, in both places
    the slot editor renders (the main gear grid and the compare panel), and it makes the level→set
    relationship visible instead of implied.
  - **`itemLevelOpt` gains a `{set}` placeholder** in both languages; `itemSet` — which existed only
    as that control's accessible name — is retired with it. The level select keeps its own
    accessible name: the user still chooses a level, and the set that follows from it is spelled out
    in the option text.
  - **New guards** cover the premise the combined label now depends on, from three sides. A catalog
    guard asserts the bijection itself — every level maps to exactly one set, no set is shared
    between two levels, and every catalog def's set is the one its native level resolves to. A
    fixture guard asserts that no committed test fixture holds an equipped item whose set disagrees
    with its level, so the planner is never fed data it could only render dishonestly. And the label
    itself is now asserted through the component's rendered output rather than its source text: the
    template helper resolves an unknown placeholder key to an empty string without throwing, so a
    mistyped key would have printed "Level 20 - " on every option while typecheck and every previous
    test stayed green.

  No behaviour change beyond the removed control: the level select already selected the set's first
  (and only) definition on change, and `setsForLevel` keeps its array return type so the bijection
  stays a checked data fact rather than a hardcoded assumption.

  Internal, no shipped behaviour attached: the end-to-end seed save carried two equipped items left
  over from before the 2026-08-15 level→set re-key (a level-20 amulet and ring still pointing at
  `steel`, which now lives at level 120). Both were repointed to their level's own set, `gold`,
  keeping every other field. Dated captures were deliberately left alone — each records what the game
  returned on its capture date, not what it returns today.

- d6ec791: Broadens `export-fingerprint.test.ts`'s corpus check from one hardcoded save-export capture to
  every committed one. `tests/fixtures/sheet-math/` is walked at run time and filtered to save
  exports by a content-based signal (`export_version` + `generated_at` both present on the parsed
  object) rather than a filename guess, so `payload-*.json` (a different, API-assembled shape) is
  excluded without naming it, and a newly ingested capture is swept without editing this file.

  Test-only: no runtime source changed. Non-vacuity is asserted two ways — the sweep must find more
  than one save-export capture, and every currently-known capture's filename must be among those
  discovered, so a rename or an accidental narrowing of the walk fails loudly instead of silently
  shrinking the corpus checked. The three named RED-state mutation tests stay on one representative
  capture (the historical 2026-08-13 file) rather than running against every corpus member: they
  exercise `checkSchema`'s missing/added-key discrimination, a property of the schema engine itself,
  which the broadened GREEN equality sweep already proves holds per file. `EXPORT_FINGERPRINT`'s own
  `sourceArtifact` provenance is unchanged — it still names the 2026-08-13 capture the key set was
  authored from, which is independent of how many captures are now checked against it.

- 387f85c: Reworks the Farm Ranking board's rotation pool row and filter placement.

  Each rotation pool chip now shows the hero's identity — avatar, rank, name, rarity and level —
  via the shared `HeroIdentityChip`, instead of a bare truncated name next to a switch. The chip
  uses a new `stacked` variant that pins it to three lines (rank+name / rarity / level) and omits
  the record id, so a grid of chips keeps one uniform height; the enable switch sits on the right
  edge of the chip. A disabled hero's identity dims and desaturates so the toggled-off state reads
  clearly beyond the switch alone.

  The unlocked/difficulty/gate filters and the return bonus picker move from the top of
  the panel down to sit directly above the ranking table (and above the "no phases match" empty
  state, so a fully-filtered board still exposes the controls needed to undo it), separated from
  the respec toolbar above by a thin divider. Those fields now share a fixed label and control
  height, so their labels and controls no longer sit on ragged baselines when one field carries a
  help tip and its neighbours are taller selects.

  A further pass over the same board:

  - Removed the FEASIBLE column and the "Feasible only" filter switch from the UI. The underlying
    `infeasible` row field and its domain computation are untouched — only the board's own column
    and filter went away.
  - The difficulty filter now lists the in-game difficulty names (Easy / Normal / Hard / Very Hard
    / Inferno, localised) instead of the bare numbers 1-5.
  - The "Show ranking under this build" re-rank toggle now only appears once Optimize has produced
    a fresh proposed build, instead of being always mounted above the table.
  - The Phase column and the respec headline now print the in-game coordinate — `Normal 1-1 (#51)`
    — instead of the wiki flavour name, so the board reads the same way the in-game map picker does.
  - The Mitigation column now prints its `%` sign.

  A fourth pass, focused on the table's overall fit and readability:

  - The Gold, Item chest, Key, Gem chest and Time chest columns now carry the matching in-game
    icon at a readable size (the same `size-8` art the Drops panel already uses), all drawn from
    the Inferno/mythic band. The Chests/Keys/Gems/Time pieces headers are reworded to the Drops
    panel's own chest-equivalent vocabulary ("Item chest", "Key", "Gem chest", "Time chest") instead
    of naming the loose resource.
  - Every rate column header drops its "/hr" suffix; each cell now states its own unit instead
    ("949.8k/h", "+6.0/h" for the signed keys column).
  - The Cage window column is removed from the table entirely — the underlying early-arrival cap
    and guaranteed window are unchanged and still shown on the Phase explorer's own Cage panel.
  - These three changes together let the table fit within a typical desktop viewport without a
    horizontal scrollbar; the table's minimum width drops from 93rem to 77rem.
  - The table header now stays pinned while only the row body scrolls underneath it, both on a tall
    row set and on a narrow viewport that still needs to scroll horizontally.

  A fifth pass, on the same five icon headers:

  - The Gold, Item chest, Key, Gem chest and Time chest headers now show only the sprite, on one
    line — the label that used to sit under it (stacking every header into two tiers) survives as
    screen-reader-only text and as a hover tooltip on the sprite instead. Sort chevrons, `aria-sort`
    and the sort announcement are unaffected.
  - Column widths are retuned now that those five headers no longer need to fit a word under the
    icon: the table's minimum width drops from 77rem to 68rem, closing the horizontal scrollbar
    that a 1280px-wide viewport used to show.

  A sixth pass, on the row's own gate marker and its resource columns:

  - The Key column's cell no longer prints a trailing "consumed" annotation on gate rows — it reads
    the signed rate alone (e.g. `-15.5/h`), the same shape a non-gate row's gain already has. This
    also frees width the annotation used to reserve, so the table's minimum width drops from 68rem to
    66.5rem.
  - The row's "Gate" chip is replaced by the game's own gate-timer clock icon, with the same word
    carried as a hover tooltip and as always-present screen-reader-only text — the marker stays
    mounted on every row (only visually hidden on non-gate ones), so no row height changes.
  - The Gem chest and Time chest cells now dim and print an em dash on non-gate rows, matching the
    Drops panel's existing treatment of a figure that cannot roll on the phase being viewed — those
    two chests only ever drop on a gate. The Item chest, Gold, XP and Key cells are unaffected: the
    first three always apply, and the Key cell states a real net rate on every row.

  A seventh pass, trimming row height:

  - The "Push target" badge on locked phases is withdrawn for now. It sat beside the phase label and
    wrapped onto a second line, growing every row it appeared on; the unlocked-only filter remains the
    way to include or exclude locked phases.
  - The Gold column's header coin is sized down a step so it reads at the same visual weight as the
    four chest sprites beside it.

  An eighth pass, virtualizing the row body:

  - The table body now mounts only the rows scrolled into view (plus a small overscan band), instead
    of every row the current filters match. Turning off "unlocked only" used to mount all 600 phase
    rows at once — a measured ~150ms hitch on that click, and every row stayed a `content-visibility:
auto` DOM node even offscreen, which is also the likely cause of the scrollbar/scroll-position
    oddities that property is known to cause. Expanding to 600 rows now mounts under 30 and lands
    under 20ms.
  - `aria-rowcount` on the table and `aria-rowindex` on each row now state the full filtered row
    count and each row's position within it — the same "no row was silently dropped by a filter"
    guarantee a full DOM row count used to prove, expressed in a form that still holds once only a
    window of rows is mounted.
  - Every body row now carries an explicit, CSS-enforced height (33px — the row's real rendered
    height, not the 44px the row's earlier `rowHeight` value assumed) instead of an unconstrained
    one, so the scroll math, the spacer rows and the scrollbar all agree with what is actually on
    screen; the visible row count feeding the window itself scales off that same real height so the
    table keeps its current visible density (about 19 rows) rather than the ~14 the old, wrong
    assumption implied.

- dfa285a: Farm cadence: average the bomb cycle over a measured hop distribution instead of collapsing to a single expected hop.

  The estimator computed `cycle = max(fuse, E_D_CELLS / w)` with `E_D_CELLS = 4.5`. That collapses the
  plant-to-plant hop distribution to its mean **before** applying `max()`, which is convex — so by
  Jensen `E[max(fuse, hop/w)] > max(fuse, E[hop]/w)`, and inverting the result to a rate compounds the
  same bias a second time. Cadence ran ~25% fast, and every downstream rate with it.

  The measured mean hop is 4.77 against the retired constant's 4.5, so the old number was barely wrong.
  Averaging first is what cost the 25%: the distribution's thin tail (hops >= 15, ~3% of plants) carries
  most of the cycle time and a mean discards it.

  `E_D_CELLS` is replaced by `HOP_DISTRIBUTION` (a 26-bucket pmf), `CYCLE_LATENCY_SEC`,
  `HOP1_CYCLE_SEC` and `cycleSecondsForHero()`. Cadence remains phase-independent, so it stays a
  per-hero fact computed once — no per-row cost and no new pipeline calls.

  Against live bot telemetry on the account-486 anchor (159 clears at phase 26), the estimator now
  lands within 3%, and two quantities that were never fitted corroborate it:

  |            | before  | after   | observed |
  | ---------- | ------- | ------- | -------- |
  | gold/hr    | 498,898 | 361,176 | 371,263  |
  | clear time | 77.3 s  | 106.8 s | ~107 s   |

  **This changes point-allocation advice, not just the farm board.** Two consequences worth knowing:

  - **CDR is no longer worthless for farming.** The old model put every plant on the walk branch, so a
    shorter fuse could never change the plant rate and `cdr` scored exactly 0. Roughly 45% of a slow
    hero's plants are short enough to be fuse-bound — observed live as a flat cycle floor across hops
    2-4 — and on those a CDR point does buy cadence.
  - **Energy overtakes Speed** on the fixture roster (speed's marginal value falls ~41%, energy is
    unchanged), because speed buys nothing on that same fuse-bound mass. The respec optimizer's
    winning build shifts toward energy accordingly.

  Known limitation: one shared distribution cannot express that heroes have individually different hop
  distributions (faster heroes get shorter hops). Against each hero's own measured distribution the
  model lands within 1%; against the pooled one it spreads to +-9%, weighted MAE 4.8% — still 5x better
  than the 25.6% the retired constant produced. Making the distribution depend on walk speed is the
  next refinement and needs captures from more than one account.

- 5a742c9: Fixes a second place the farm-rate estimator modelled unlimited-parallel House recovery: the
  Fortuna aura (`fortunaAura`) summed every hero's own unconstrained duty cycle, so a roster
  throttled by the House recovery-slot ceiling still got full credit toward the aura for heroes the
  House could not actually keep on the field. On a roster overcommitting the House by 1.7x, this
  overcounted `fortunaAura` — and the `goldPerHour` it multiplies — by the same ratio.

  `fortunaAura` now sums `uptime_h × activity_h` (the House-allocated on-field fraction), the same
  basis `heroesOnField` already uses. Because that allocation is phase-dependent (it is ranked by
  props-per-deployment, which depends on the phase's mitigation), `fortunaAura` moves from
  `SquadFarmFacts` to `FarmRateRow`, following `concurrencyScale`'s precedent from the House-ceiling
  fix. `sorteFraction` stays on the unconstrained, phase-independent basis: it is a normalized
  average rather than an unnormalized sum, so the same overcommit does not inflate it, and
  reweighting it would have no fixed direction absent a roster where combat value-density and Sorte
  investment are correlated.

  API: `SquadFarmFacts` loses `fortunaAura`; `FarmRateRow` gains it.

- 37c30bf: Reworks the Farm Respec Advisor's metric tile row.

  The Gold/hr and Chests/hr tiles now carry the game's own coin and chest icons beside their
  labels, and each one's `current → proposed` value carries its own signed percent change alongside
  it (e.g. "171,081 → 180,075 (+5.3%)") — `@bombfarm/domain` exposes this as two new signed fields,
  `goldGainPct` and `chestsGainPct`, on `FarmRespecResult`. Unlike the existing `gainPct` (the
  active objective's value, clamped `>= 0`), these two are deliberately unclamped: whichever
  currency is not being optimized can legitimately fall, and a clamped-to-zero percent would
  contradict the tile's own "gives up N gold/hr for this objective" note sitting right next to it.

  A new "Phase" tile sits between the rate tiles and the cost/payback tiles, showing the recommended
  phase to farm before and after the proposed respec (`Easy 3-7 (#27) → Normal 1-1 (#51)`), so the
  phase change driving the gold/chest numbers is visible without leaving the panel. When the
  proposal does not move the phase, the tile shows the phase once plus a small "(same phase)" note
  instead of printing the identical label twice. The tile row now spans 2/3/5 columns at
  mobile/tablet/desktop widths to fit the fifth tile.

  The Payback tile's label is now itself the tooltip trigger (a dotted underline, matching
  `@bombfarm/ui`'s existing `StatList` glossary-term idiom) explaining what the figure actually
  divides — the respec cost by the _increase_ in gold/hr the new build earns, not the new rate on
  its own — after players misread "pays for itself in 0.3 h" as computed against the new gold/hr
  alone. `@bombfarm/ui` exports its existing `TipLabel` primitive from the barrel for this.

  `@bombfarm/domain` also adds `chestIconSrc()` next to the existing `goldIconSrc()`, sourcing the
  same sprite `dropIconSrc('chest', ato)` already used for the neutral, difficulty-independent
  item-chest icon.

- 37c30bf: The heroes that need no respec now share one line instead of repeating themselves. Each card used
  to carry the same "no respec needed" sentence and its own share of the gold you save, leaving you
  to add those up. The sentence is now stated once above the group, over the total.
- 687aacb: Adds a wall-time guard to the farm respec solver's performance suite. The existing budget assertion
  counts evaluations, which cannot catch a change that keeps the count identical and makes each
  evaluation more expensive — the exact shape of a recent cadence-math change. The new case asserts
  the best of three full solves on the committed 5-hero fixture stays inside a generous ceiling, with
  the measured baseline recorded alongside it. No behavior change.
- 0418a82: Re-synced the item catalog against the 2026-08-16 redistribution patch.

  No value changed — `stat_base`, `nivel_mult`, `forja` and the 30 sets / 240 definitions are all
  byte-identical. What moved is **which stats each slot rolls, and in what order**: 239 of 240
  definitions, 194 of them changing their stat set outright. Because rarity slices the first N
  rolls, that changes what real items carry — **1,100 of 1,440 (definition × rarity) pairs now roll
  a different stat set**, including 217 of 240 at Raro and 219 at Épico.

  The new order is uniform across every set, one priority per slot:

  | slot    | priority                                                      |
  | ------- | ------------------------------------------------------------- |
  | arma    | dmg > crit > penetração > recarga > velocidade > energia      |
  | elmo    | energia > sorte > dmg > crit > penetração > recarga           |
  | peito   | **penetração** > recarga > velocidade > energia > sorte > dmg |
  | calça   | **recarga** > velocidade > energia > sorte > dmg > crit       |
  | bota    | velocidade > energia > sorte > dmg > crit > penetração        |
  | luva    | dmg > penetração > velocidade > sorte > crit > recarga        |
  | anel    | crit > penetração > recarga > velocidade > energia > sorte    |
  | amuleto | sorte > dmg > crit > penetração > recarga > velocidade        |

  Crit chance left the top two on six of eight slots — it is now concentrated in `anel` and `arma`.

  No sheet-math change: `stat_base` did not move, so the flat crit/cooldown model is untouched.

- 20f53bb: Adds the 8th cosmetic hero appearance so a hero saved with `skin: 7` stops rendering someone
  else's face, refreshes all 8 avatars from the wiki, and adds a guard test against half-applied
  edits to the skin table.

  The game ships 8 cosmetic appearances, but `HERO_SKIN_COUNT` was 7 and `SKIN_AVATAR_FILE` had
  only seven entries. `heroAvatarSrc` indexes that array and falls back to `?? 1`, so skin 7 fell
  off the end and resolved to `hero1_avatar.png` — every hero wearing the 8th appearance rendered
  **skin 1's face**. That is the bad failure mode: not a broken image or a blank frame that someone
  would notice and report, but confidently wrong art that looks fine. Import was affected the same
  way, since `isKnownSkin` shares the bound: a save carrying `skin: 7` was treated as out of range
  and reset to the neutral placeholder `0`, discarding the real value on disk.

  - **`HERO_SKIN_COUNT` is now 8** and `SKIN_AVATAR_FILE` maps skin 7 to `hero8_avatar.png`. The
    existing `hero2`/`hero3` swap against in-game skins 1/2 is unchanged. Skin 7 → file 8 is
    inferred from the identity mapping that holds for indices 3..6; it is noted in the source as
    not yet confirmed against an in-game save carrying `skin: 7`.
  - **All 8 avatars are re-bundled from the wiki at its current 192x192.** Skins 0–6 were
    previously bundled at 256x256; dropping them to 192x192 is deliberate, so the whole set is one
    internally consistent mirror of the wiki's current art rather than a mix of two vintages. The
    characters are unchanged — every filename still holds the same face, so no stored `skin` value
    changes meaning.
  - **A new guard** in the `bundled wiki assets` suite resolves every skin index `0..N-1` through
    `heroAvatarSrc` and asserts the file exists, then asserts the reverse — that no bundled
    `hero{N}_avatar.png` is unreachable from a skin index — and that no two indices resolve to the
    same file, which is the `?? 1` fallback's signature. Its scope is deliberately narrow: it
    catches a **half-applied** skin edit (count raised without art, art added without the count,
    two indices sharing a file). It would **not** have caught this bug — with `HERO_SKIN_COUNT = 7`
    and seven bundled files the guard is green, because the table and the bundle agreed with each
    other and only disagreed with the game. Noticing _that_ needs a signal from outside the app,
    which nothing currently watches.

  The free/premium split of the 8 appearances is not surfaced anywhere in the UI; this change is
  art and indexing only.

- 5a742c9: Fixes a regression the House-ceiling fix introduced: `resolveHouseRestSeconds` returned the
  account's imported `casa.cycle_secs` unconditionally whenever it was positive, ignoring the
  `houseIndex`/`level` it was actually asked about. Once an account imported with a captured House
  cycle, the House and House-level pickers stopped changing any computed number (advisor DPS, the
  farm board, the team plan) — the frozen save figure kept winning no matter what house or level was
  selected, even though the picker's own displayed rest time kept changing. Repro: import an account,
  switch House (or House level), advisor DPS/farm board/team plan numbers stayed pinned to the
  imported figure.

  `resolveHouseRestSeconds` now takes the (house, level) pair the save's `cycle_secs` was captured
  at — `casa.active_casa - 1` / `casa.levels[active_casa - 1]` — and trusts the save's figure only
  when the requested house/level equal that pair exactly; otherwise it falls back to the `HOUSES`
  table, same as an account with no captured cycle at all. Two optional anchor params are threaded
  end to end: `FarmContextForHeroInput`, `AdvisorPipelineInput`, `team-plan`'s `FarmContext`/
  `TeamPlanAccountInput`, and the domain `AccountShared` shim all gain
  `houseCycleSecsHouseIdx`/`houseCycleSecsLevel` (or `cycleSecsHouseIdx`/`cycleSecsLevel`) alongside
  their existing `houseCycleSecs`/`cycleSecs`. Left unsupplied (the 3-arg call shape), the resolver
  keeps its prior behaviour — trusting `cycleSecs` unconditionally — because every caller outside the
  web planner's account store has no independent picker able to diverge from the import in the first
  place; only the web store's account slice populates a real anchor, snapshotted separately from the
  live `houseIdx`/`houseLevel` picker so a picker move is what falls back to the table, not a stale
  anchor silently going along for the ride.

  Two rendering surfaces also read the raw `HOUSES` table directly instead of the resolver the model
  now uses everywhere else, so they contradicted the numbers they were labelling: the Account panel's
  House-level field (`account-house-fields.tsx`) and the import preview's House summary
  (`import-account-summary.tsx`). Both now call `resolveHouseRestSeconds` the same way the model
  does.

  API: `resolveHouseRestSeconds` (`@bombfarm/domain/model`) gains two optional trailing params,
  `cycleSecsHouseIndex`/`cycleSecsLevel`. `AccountImportData`/`AccountShared` (web and domain) are
  unchanged in shape at the import layer — the anchor is derived from the import's own
  `houseIdx`/`houseLevel` at the moment `houseCycleSecs` is set, not a new parsed field.

- bbd5397: Fixed the item drop level the planner reports for a phase. The 2026-08-15 game update re-cut the
  drop bands from nine, topping out at item level 90, to thirty running item level 10 through 300 —
  the same ladder that patch gave the item catalog. The committed wiki bundle predated the patch and
  kept answering the old table, so the planner under-reported the level on most of the game: phase 51
  and phase 60 were both shown as level 20 where the game itself says level 30.

  Visible in two places: the Phases tab's "Item drops" row in the phase facts panel, and the item
  band column of the farm-ranking table. Ranges such as "30–40" still mean what they meant — the
  bands overlap by ten phases, so either tier can roll there — but the numbers on both sides of the
  dash are now the ones the game shows. End-game phases move the most: phase 600 reads 300 instead
  of 90.

  No formula changed and no throughput number moved. The item level is a display field on both
  `PhaseIntelGlobal` and `FarmRateRow`; nothing in the gold, XP, drop or solver math reads it.

  A new domain test pins all thirty bands against the table's closed form and against two live
  in-game readings, so a stale or half-applied refresh of this key fails loudly instead of shipping
  a table with a hole in it.

- 3d0d97b: Show per-phase combat numbers on the Farm page's hero and squad panels

  "Your hero" printed one crit-weighted average hit and nothing else. It now breaks that into the
  normal hit, the critical hit, and the average between them, and adds field time per deployment.

  The Top-N by solo DPS table traded its gear, abilities and power columns — roster facts that say
  nothing about how a build performs against the selected phase's mitigation — for the same three
  numbers, so every row is directly comparable with the hero panel above it.

  `RosterDpsRow` and `HeroPhaseFit` carry `normalHit`, `critHit` and `fieldSecs`; all three come
  straight off the advisor pipeline, which now surfaces `fieldSecs` alongside the `uptime` derived
  from it. `computeHeroPhaseFit` takes a named-argument object rather than nine positional
  parameters.

- 71fb344: Shows each prop's in-game art next to its name in the two phase prop tables — the phase
  **Prop mix** table and the **Your hero** hits-to-kill table.

  Both tables named their target prop in text alone, which reads nothing like the game: players
  recognise a bush or a mithril node by its sprite long before they read its label, and the two
  crystal props in particular are told apart by colour in-game and only by wording in the planner.
  The art was already bundled under `public/wiki-assets/env/` for other surfaces, so this is a
  display change with no new assets and no math touched.

  - **`propIconSrc(propName)` in `@bombfarm/domain`'s `wiki-assets`** — every prop's `name` in
    `PROPS` is also its art filename, so the helper is the same bare join as `abilityIconSrc`, and
    returns `null` on an absent name rather than a `/env/.png` path to nothing.
  - **A `PropIcon` component** in the web planner's `game-art` set, rendered at `size-4` inside the
    existing name cell — no column was added and the HP and HITS columns are untouched. The icon is
    decorative (`alt=""`, `aria-hidden`): the prop's label sits beside it in the same cell and
    remains the accessible text, so screen readers hear the name once, not twice. No new
    user-facing string, hence no i18n change.
  - **The icon does not change the row height**, but only because its wrapper is a block-level
    `flex`. That was measured in the browser rather than assumed: inside an `inline-flex` the
    wrapper sits on the text baseline, the 16px image hangs below it, and the rows grow from 29px
    to 33px — which quietly changes what `DataTable`'s `maxRows={12}` scrollport actually shows,
    since its height is `rowHeight * maxRows` against a fixed `2rem` estimate. With `flex` the rows
    measure 29px, the same as before the icon.
  - **A guard** in the `bundled wiki assets` suite resolves every `PROPS[].name` through
    `propIconSrc` and asserts the file is on disk, alongside the existing sweeps for abilities,
    items and hero art. It is deliberately forward-only: `env/` is a mixed directory that also
    holds `bomb`, `boss`, `jaula` and the `cage_ato*` sprites, so the reverse "no orphaned art"
    assertion the item and hero guards make would fail there on art that is legitimately used
    elsewhere. A renamed prop or an unbundled mirror is the failure this catches — a well-formed
    path to a file that does not exist, which type checking and the phase math tests cannot see.

- 590a5e9: Adds a new `sheet-math` corpus fixture, `save-20260817-11heroes.json` — a scrubbed live save
  export, the largest roster and highest phase captured to date (11 heroes; account `phase: 51`,
  `max_phase: 62`). Test-only: no runtime source changed, and the fixture's item catalog matches
  the shapes already committed in `save-20260816-9heroes-redistrib.json`.

  Whole-roster round trip is verified issue-free on all 11 heroes (`inferSpentPoints` /
  `composeSheetFromBirth`), every point budget lands exactly on `level`, and the corpus's
  provenance manifest (`packages/domain/tests/fixtures/sheet-math/README.md`, mirrored at
  `apps/web/src/tests/fixtures/sheet-math/README.md`) records what it may and may not prove — same
  `stars: 0` / `stat_points_available: 0` limitation as the rest of the post-wipe corpus.

  Two corpus-sweep guards move to account for the new file:
  `packages/domain/tests/points-within-level-budget.test.ts`'s per-file hero-count map (now three
  post-redistribution files, 25 heroes total), and `apps/web/src/tests/import-save.test.ts` gains a
  real-fixture acceptance case so the fixture-corpus orphan sweep has a live consumer on the web
  side too.

- 560f83d: Finishes untangling House recovery slots from field concurrency slots (started in #86) in two more
  places that predate that fix:

  - The team-plan optimizer's roster objective (`evaluateRoster`, reached via `TeamPlanAccountInput`)
    used `account.slots` (`casa.slots`, House recovery concurrency) as the field-saturation cap. A
    new `TeamPlanAccountInput.fieldSlots` carries the correct FIELD concurrency number instead
    (`account.fieldSlots ?? account.slots`, same fallback convention as `farm-rate.ts`'s
    `SquadFarmFacts`); on an account where the two disagree (486: 3 vs 6), the optimizer was
    saturating and stopping early with half the field empty.
  - `rankRosterByDps`'s default squad-size limit (Phases "top squad" panel, roster ranking) now
    prefers `account.fieldSlots` over `account.slots` for the same reason — the squad it ranks is
    who can be on the field at once, not who the House can refill at once.

  No change for a save where the two values agree, or for a legacy record with no `fieldSlots` at
  all (still falls back to `account.slots`, then `DEFAULT_CASA_SLOTS`).

- Updated dependencies [06bcc05]
  - @bombfarm/contracts@0.3.1

## 0.5.0

### Minor Changes

- f0bf7f4: `@bombfarm/domain` is now consumed as a **built package** (`dist/` + `.d.ts`), the same way
  `@bombfarm/contracts`, `@bombfarm/game-api`, `@bombfarm/game-data` and `@bombfarm/pricing`
  already are, instead of advertising its TypeScript source through `exports`. This is a
  packaging contract change, not a math change: not one byte of `packages/domain/src` — the
  sheet math MP2's fidelity gate protects to a worst error of `1.1e-11` — was touched. The
  package's `exports` map now targets `dist/**` (four directory subpaths — `./gear`, `./model`,
  `./stat-breakdown`, `./team-plan` — plus a `./data/*` JSON target and a file/nested-file
  wildcard), and a new packaging test proves every in-use `@bombfarm/domain[/subpath]` specifier
  in the repo resolves through Node's own module resolver, not just by reading the map.

  **The desktop can now compute with the planner engine.** `@bombfarm/desktop` declares
  `@bombfarm/domain` as a real `workspace:*` dependency (it previously resolved only by
  accident, via pnpm's root-level hoisting) and imports it from both processes: the main process
  computes a value through the built package under its own strict TypeScript bar
  (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), and the renderer renders one
  domain-derived label. Neither import adds any planning UI, recompute, or i18n wiring — that is
  later MP3 work (F2/F3/F4). This feature only proves the edge compiles, bundles (esbuild inlines
  the domain code; the desktop's own long-running team-plan solver is confirmed absent from the
  bundle), and reaches the DOM.

  **No behaviour change for the web planner.** `apps/web` keeps resolving `@bombfarm/domain`
  through its existing tsconfig `paths` and bundler aliases — it never reads the new `exports`
  map — and zero files under `apps/web` changed in this release. A guard test now pins those
  resolution entries so a future cleanup cannot silently move the public planner onto `dist`,
  which Vercel's production build never produces.

  `docs/typescript-planner-origin.md`'s documented strictness exception for `@bombfarm/domain`
  and `@bombfarm/ui` is unchanged in scope — the same two packages, the same ESLint globs. A
  consumer built against `dist` never compiles domain's source under its own relaxed bar at all,
  so this packaging change is orthogonal to that exception rather than an extension of it.

- 96d496a: **The desktop renders real hero planning advice with the game closed.** A new Planning tab
  (`AppShell` nav) reads the already-persisted `AccountView` once on mount and shows the roster,
  each hero's next-point ranking, and reset advice, computed through `@bombfarm/domain`'s advisor
  pipeline — the same engine the web planner runs.

  `packages/domain/src/roster-dps.ts`'s `pipelineForHero` is now a public export (`AD-032`): the
  only `HeroRecord`-shaped entry to the pipeline, and the one mapping both surfaces use. Its body is
  byte-unchanged; a layer-1 parity test (`packages/domain/tests/pipeline-for-hero-parity.test.ts`)
  and a layer-2 source-derived key-set guard (`tools/advisor-input-parity.test.mjs`) together prove
  the desktop and the web compute identical ranked stats and gains for the same account payload,
  for every observed `crit_dmg_mult`. The one known, pinned divergence (`treeCritDmgMult`, `AD-038`)
  is documented at the export site and asserted not to widen or silently close — it is not fixed
  here, because doing so would change the web planner's own rendered numbers.

  **Honesty over completeness, by construction (`D24`).** Every number the desktop shows is gated
  by the usability of the account sections it depends on (`resolved`/`stale` render; `missing`/
  `degraded` withhold, never a fallback). An exhaustive, table-driven matrix
  (`apps/desktop/renderer/lib/planning/withhold-matrix.test.ts`) asserts the fallback numbers
  `import-save.ts`'s zero-tree default would otherwise produce are never reachable when their
  backing data is not trustworthy.

  **No behaviour change for the web planner.** `apps/web` is untouched — zero files changed, source
  and tests alike. `packages/ui` is untouched too (`DS-09` intact): every control on the new screen
  composes existing `@bombfarm/ui` primitives.

  Two known, recorded limitations ship with this feature rather than being silently claimed:
  `degraded` sections are implemented and unit-tested but currently unreachable end to end (the
  account-restore merge prefers a stale body over a degraded live read, `AD-037`); and the manual
  refresh affordance (`account:refresh`, `READ_PACING.manualRefreshFloorMs`) was not taken in this
  pass and remains unimplemented, not merely deferred.

- fc7fcf1: **All modelled keystone mechanics are deleted from `@bombfarm/domain`.** The 2026-08-13 patch
  removed all five keystones and wiped every account; `skills.totals` no longer emits `keystones`,
  `abisso_base` or `crit_dmg_mult`. The domain package stopped modelling Abisso's damage multiplier,
  Glass Cannon's crit ×2 / energy ×0.5, and Tempo Dobrado's speed ×1.33333 / drain ×2 — this is pure
  deletion of dead mechanics, not a behaviour change: every removed term was already an identity
  element (`× 1`, `+ 0`) on every keystone-free input the post-patch game can produce, proven by a
  committed pre-deletion characterization baseline compared bit-exactly (`Object.is`) against the
  post-deletion output.

  **No number changes for any keystone-free input.** The one non-numeric exception is
  `formulaDmg.substituted`, whose rendered string drops the `× 1.000` Abisso factor while the
  underlying `value` is unchanged.

  **Removed public API:**

  - `effectiveTreeSheetForAbisso` (`birth-sheet.ts`, re-exported from `model/index.ts`)
  - `detectGlassCannon`, `detectTempoDobrado`, `normalizeKeystones` (`save-units.ts`)
  - `unmodelledTreeFindings`, `UnmodelledTreeInput` (`tree-guards.ts`, deleted outright, re-exported
    from `model/index.ts`)
  - `TreeSheetTotals.critDmgMult`, `.glassCannon`, `.tempoDobrado` (six surviving members remain:
    `danoStatic`, `energyPct`, `speedPct`, `critChancePct`, `critDmgPct`, `luckFlatPct`)
  - `AdvisorPipelineInput.treeGlassCannon`, `.treeCritDmgMult`, `.treeTempoDobrado`, `.treeAbisso`,
    `.treeAbissoBase`
  - `AdvisorPipelineResult.abissoMult`
  - `CombatMults.abissoMult`
  - `ComputeCombatMultsInput.treeAbisso`, `.treeAbissoBase`
  - `FarmContextForHeroInput.treeTempoDobrado`
  - `TreeState.glassCannon`, `.tempoDobrado`, `.abisso`, `.abissoBase`, `.critDmgMult`
    (`shims/storage.ts` — the type the MP5 milestone calls `AccountTree`)
  - `PipelineFacts.abissoMult`, `.critDmgMult` keystone-derived members
  - `TeamPlanAccount`'s `treeAbisso` / `treeAbissoBase` / `treeTempoDobrado` members
  - `LedgerNote`'s `'glassCannon'` and `'tempoDobrado'` union members

  **Kept, deliberately:** `CombatMults.critDmgMult` / `DeriveInput.critDmgMult` — a dead
  combat-layer pass-through hardcoded to `1` since the keystone correction, with no keystone content
  of its own. Removing it would be an unrelated public-signature change to `derive()`.

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

- Updated dependencies [1fa3def]
- Updated dependencies [e78122a]
- Updated dependencies [453ed05]
  - @bombfarm/contracts@0.3.0

## 0.4.0

### Minor Changes

- 66d38d0: Add a source-neutral account payload contract and route save-file parsing through it.

  `@bombfarm/contracts` gains `AccountPayload` plus its per-section fidelity types
  (`AccountSection`, `SectionStatus`, `SectionFidelity`, `AccountFidelity`, `AccountFidelityGrade`,
  `AccountFidelityReport`) — the typed shape both the web upload path and the future desktop
  live-memory reader (MP2 F2) will target. It declares no `export_version` / `generated_at`; those
  stay file-only.

  `@bombfarm/domain`'s `parseSaveFile` is now a five-line file adapter over a new exported entry
  point, `parseAccountPayload(payload, existing)`, which takes the typed payload directly instead
  of a raw file object. The ~250-line parsing body itself did not move, change, or reorder — only
  the wrapping changed. A new `deriveAccountFidelity` (with the `ACCOUNT_SECTIONS` constant) turns
  a per-section fidelity block into one overall grade (`full` / `degraded` / `unavailable`) plus the
  list of degraded sections; it is pure, with no I/O.

  No behaviour change for the web planner: `parseSaveFile`'s name, signature, and exact output
  (including warning strings and their order) are unchanged, proven by a digest against the
  pre-refactor result on the canonical fixtures, and by all 74 existing `apps/web` import tests
  passing byte-unchanged. `@bombfarm/web` is not listed above — it picks up an automatic patch
  from the `@bombfarm/domain` dependency bump, but nothing a planner user can observe changed.

### Patch Changes

- e55ebda: Add a consented, read-only reader for the account state the game's own server holds — roster,
  skills, casa, bag, gold and phase — replacing the plan for a memory-assembled account after a
  live calibration capture proved the game only loads that data on demand (a silently absent
  skill tree is not an empty tree; it is wrong advice computed from a zeroed one).

  **This is the first release in which the desktop contacts a network host on the player's
  behalf.** It happens only after the player explicitly accepts a first-run modal that states
  plainly what is used (the session token the game itself already saves locally), where it goes
  (`api.bombfarm.net` and nowhere else), that access is read-only, that no disruptive action is
  ever taken without approval, and that the decision is reversible at any time. Declining leaves
  the app fully usable on whatever account data was already stored.

  `@bombfarm/game-api` is a new package: a GET-only client (no write route exists anywhere in it,
  enforced by a guard test) built from a consent reducer, a token type that cannot be printed,
  serialised, or logged by any call site that forgets to redact it, a single-flight paced request
  path with a bounded cooldown backoff, the five account routes with committed response
  fingerprints that catch a game update before it is silently misread, and an assembler that
  turns one cycle's reads into a per-section fidelity report with no carry-over of its own.

  `@bombfarm/contracts` gains a fourth `SectionStatus`, `degraded` — the source answered, but its
  shape is no longer one this app parses safely, so it carries no body rather than a plausible
  wrong number — plus the `consent:get`/`accept`/`decline`/`revoke` IPC channels and the
  `consent:changed`/`account:changed` events.

  `@bombfarm/desktop` gains the platform edge that makes this real: the one `https` socket, the
  gated read of the token file, consent persisted alongside the existing account database, and
  the cycle that ties them to the account store's own last-known-good carry-over — a route that
  fails this cycle is served back from storage, honestly labelled stale, never silently dropped.
  Memory continues to serve combat telemetry only; the account state it can no longer be trusted
  to assemble is not looked to as a fallback, in this feature or ever.

  `@bombfarm/domain` gains a test file and committed fixtures proving the assembled payload
  parses through its unmodified parser (`packages/domain/src` is untouched) — a `patch`, since
  `changeset status` treats any change under a package's directory as package-changed regardless
  of whether it touched `src` or `tests`, and `updateInternalDependencies: patch` would apply this
  bump automatically the moment its `@bombfarm/contracts` dependency moves regardless.

  No web planner behaviour changes.

- Updated dependencies [84c8c15]
- Updated dependencies [66d38d0]
- Updated dependencies [e55ebda]
  - @bombfarm/contracts@0.2.0

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
