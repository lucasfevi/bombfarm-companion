# The post-patch fixture corpus (MP5 F1, `mp5-fixture-rebaseline`)

**Status (2026-08-13):** the 2026-08-13 patch removed all five keystones (Abisso/D15, Glass
Cannon/C15, Tempo Dobrado/V15, Juro Composto/O15, Sorte Composta/S15) and wiped every account.
The 41 pre-patch capture files this repo's test suites were built on — 39 `sheet-math` fixtures
plus the two old fidelity-gate captures — described an account the game can no longer produce.
This feature deletes them, deletes the 20 test files that carried the
`QUARANTINED` (catalog v4, 2026-08-11) header, re-points the ~30 surviving suites that depended
on the deleted corpus onto a new post-patch corpus, and records here what that cost.

## 1. What the corpus is now

Two captures, committed once to `packages/domain/tests/fixtures/sheet-math/`. `apps/web` reads
this same directory by relative path rather than holding its own copy — the two trees carried a
byte-identical duplicate until it was deduped, and `tools/fixture-corpus-parity.test.mjs` now
fails if that duplicate ever comes back:

- **`save-20260813-5heroes.json`** — a scrubbed 2026-08-13 save export, account 486 (post-wipe),
  5 heroes (Jon L38 4/8 geared, Bellatrix L42 8/8 geared, two Perrins L4/L3 naked, Lyra L2 naked).
- **`payload-20260812-8heroes.json`** — a byte copy of the already-committed
  `packages/domain/tests/fixtures/api/assembled-payload-before.json`, an `AccountPayload` from a
  different, disjoint account (8 heroes, phase 21).

Per-file provenance (source capture, capture date, scrub list, both SHA-256 hashes, what each
file may and may not prove) lives beside the fixtures in
[`packages/domain/tests/fixtures/sheet-math/README.md`](../packages/domain/tests/fixtures/sheet-math/README.md)
(byte-identical to the web copy). This document is the narrative and the loss record; that one is
the per-file manifest.

## 2. Why the old corpus is gone

Under `AD-062`'s positive discriminator (`skills.refunds` / `skills.totals.vagas_campo` /
`skills.totals.bag_tabs_bonus` — post-patch-only keys), **every one of the 41 pre-patch capture
files was an invalid save**: all 41 carried `keystones`, `abisso_base` and `crit_dmg_mult`
(pre-patch-only keys), and none carried any of the three new keys. That is the exact input
`mp5-schema-guard` (F4) is being built to reject. The corpus was not merely stale — it was the
thing the next feature exists to catch.

## 3. Per-deleted-file loss table

All 20 quarantined files carried the `QUARANTINED` (catalog v4, 2026-08-11) header; 11 of them
also carried live `describe` blocks that ran and passed today. Deleting the file deletes those
blocks too. Tagged **model-only** (read no fixture — the block's assertions are pure function
calls) or **corpus-anchored** (needed the deleted account to exist at all).

| File | Live blocks | Kind |
| --- | --- | --- |
| `domain/abisso-damage-mult.test.ts` | 4 | model-only (calls `computeCombatMults` directly — gating/clamping) |
| `domain/birth-sheet.test.ts` | 4 | corpus-anchored |
| `web/birth-sheet.test.ts` | 4 | corpus-anchored |
| `domain/game-sheet-view.test.ts` | 3 | corpus-anchored |
| `domain/keystone-sheet-corrections.test.ts` | 1 | corpus-anchored |
| `domain/sheet-peel.test.ts` | 5 | corpus-anchored |
| `web/sheet-peel.test.ts` | 6 | corpus-anchored |
| `domain/sheet-math-fixtures.test.ts` | 1 | model-only (`SHEET_KEYS` ↔ `SHEET_ABS_TOL` tolerance smoke) |
| `web/sheet-math-fixtures.test.ts` | 1 | model-only (same tolerance smoke) |
| `domain/point-inference.test.ts` | 1 | corpus-anchored |
| `web/point-inference.test.ts` | 1 | corpus-anchored |
| the other 9 files (`birth-import-fidelity` ×2, `loadout` ×2, `real-data` ×2, `uncapped-penetration` ×2, `web/tree-sheet-selectors`) | 0 | fully skip-only already |

**The tolerance smoke's claim survives; the file does not.** `Object.keys(SHEET_ABS_TOL) ===
SHEET_KEYS` is restated as one line in the new `fixture-corpus.test.ts` guard (both trees).

**`abisso-damage-mult.test.ts`'s gating/clamping describes call `computeCombatMults` directly on
keystone math `F2` deletes anyway** — recorded as lost, not rescued into a surviving file (spec's
default: whole-file deletion, OQ-2).

**The `point-inference` and `sheet-peel` corpus-anchored claims have the strongest available
replacement**: §6 below, the round-trip invariant.

### Other deletions recorded here

- **`account-source-parity.test.ts`'s three inline `ParseResult` digests** (`toMatchInlineSnapshot`
  at the old lines 27/32/37) — `AD-068`: they are SHA-256 hashes of *our own output* captured
  against a pre-refactor HEAD. Deleted, never regenerated; regenerating them against a new
  fixture would assert nothing. The `__snapshots__/account-source-parity.test.ts.snap` file
  (whose only entry was keyed by the deleted `vera-01-points-reset.json`) was deleted in the
  same commit.
- **`team-plan-waterfall.test.ts`'s one non-quarantined `it.skip`** (`permits a listed point reset
  with a negative gainPct`) — its subject (`save-20260801-crit-dmg-tree.json`, hero 37446) died
  with the rest of the pre-wipe corpus; nobody has looked for a fresh empirical example on the
  new substrate, so it was deleted rather than re-pointed onto an unverified subject.
- **`luck-sheet.test.ts`'s `luck per-point value against Wave 0 fixtures` block** (2 tests, Vera
  ★0 and Bellatrix ★1) — the point-delta before/after family (§5).
- **`ability-catalog.test.ts`'s AC-20** (Korin, id 43040, `golpe_brutal` rank 1 recomposition
  proof) — no hero in either post-patch capture owned `golpe_brutal` at the time (scanned
  exhaustively). **That is no longer true of the corpus**: four captures now carry the ability,
  `save-20260818-12heroes.json` (Doran 20/20) and `save-20260823-13heroes-crit-points.json`
  (`Buff S #1` 20/20) among them, and the flat shape is asserted directly in
  `points-within-level-budget.test.ts`. Whether AC-20 itself should be re-instated on one of them
  is an open call, not settled by this correction.
- **`ability-catalog.test.ts`'s AC-02** re-measured, not deleted: the payload's 8 heroes own 11
  distinct ability codes, not the deleted fixture's 13 — **two codes lose their in-fixture slot
  check** (the claim itself still re-points cleanly for the 11 that remain).
- **`ability-point-budget.test.ts`'s dead-point boundary case** (`Bram L49 Incomum → 40 spendable
  / 9 dead`, `Torin L45 → 40 / 5`) — no hero on either post-patch corpus file exceeds
  `quota × 20`; replaced with real rows from the new corpus, all with `dead: 0`. The synthetic
  Mítico L100 case (`AD-BSP-23a`) still demonstrates the boundary math directly.
- **`derive.test.ts`'s crit-damage-specific double-count discrimination** — every post-patch
  capture has `crit_dmg_add: 0` in `skills.totals`, so AC-30/AC-31/AC-32 can no longer
  discriminate a crit-damage-specific doubling bug the way the deleted crit-dmg-tree fixture
  could. The `critChance`/`energy`/`speed`/`attack` axes of the same assertions still
  discriminate (their tree percentages are nonzero on the re-pointed hero).
- **`derive.test.ts`'s `brenna-01` ↔ `brenna-03` gear-swap comparison** — unreproducible from one
  snapshot (§5). What survives is `derive`'s structural claims on real geared heroes: Jon 4/8 and
  Bellatrix 8/8 (export), Cora 4/8 (payload).
- **`import-save.test.ts` (web): the real-fixture whole-file `missingBirthStats` reject
  demonstration** (`gale-01-points-reset.json`, 16 heroes, 0 with `birth_stats`) — every
  post-patch capture carries `birth_stats` on every hero by construction, so no committed
  fixture can reproduce a whole-account pre-`birth_stats` shape any more. The reject-gate LOGIC
  stays covered by `account-source-parity.test.ts`'s synthetic multi-hero missing-`birth_stats`
  cases.
- **`import-save.test.ts` (web): AC-28** (a known ability code at level 0 pushes no issue) — no
  ability entry at level 0 exists in either post-patch capture (every entry is level ≥ 17).
- **`import-inventory-sync.test.ts` (web): the Abisso half of a real-fixture disclosure test** —
  `treeAbisso`/`treeAbissoBase` flowing from a real save's `abisso_base` is unreproducible (no
  post-patch capture carries the key at all, §4). Abisso detection itself stays covered by
  `abisso-glass-cannon.test.ts` (F2's surface, untouched by F1) via synthetic payloads.
- **`apps/web/e2e/team-plan-disclosures.spec.ts`'s `saturated account shows saturation callout`
  test** was found RED on the new corpus during T7 (its `slots: 2` override was tuned for the
  deleted 11-hero fixture's ~2.5–3.2 `sumDuty` range) and was fixed by an orchestrator ruling
  that extended `AD-069`'s three-file exception to this fourth `apps/web/e2e/**` file. On the
  5-hero export, `slots` alone can no longer force the saturated regime — this roster's own
  `sumDuty` tops out at ~0.99 at the export's real house, strictly below the minimum `slots`
  value `evaluateRoster` clamps to. `duty = fieldSeconds / (fieldSeconds + restSeconds)`
  (`model/combat.ts`) is driven by house rest time, not slots, so the seed was retuned onto a
  maxed house (Casa V, level 20 — the shortest rest in `HOUSES`), which measures `sumDuty` ~2.12
  and clears `slots: 1` with better than 2x margin. `e2e-smoke` is 132/132.

## 4. The three named accepted losses (`AD-061`)

Each attributed to `AD-061` (the patch made the underlying account unrecapturable), each naming
`D25`'s wiki detector (**F5**) as the *replacement for the deleted coverage, not a bonus
deliverable*:

1. **Deleting `abisso-damage-mult.test.ts` unpins the committed `phases.json` mitigation table.**
   Verified: nothing else in the repository asserts `phaseLine(phase).mitig` against an observed
   game value. Both `phases.test.ts` copies test only clamping (`1..600`) and prop helpers;
   `phase-intel.test.ts` reads a wiki snapshot, not a game observation.
2. **High-phase mitigation coverage is permanently gone.** The deleted `phase-151.json` was the
   corpus's only `max_phase 600` / phase-151+ artifact; the post-patch account's `max_phase` caps
   at 42.
3. **The nv50+ Dano question loses its last coverage.**

## 5. Unreproducible fixture families

Every post-wipe corpus hero has `stat_points_available: 0` — every stat point is already spent.
That structurally kills every family below; none of them can be rebuilt from a single snapshot.

| Family | Deleted fixtures | Why unreproducible | Capture that would restore it |
| --- | --- | --- | --- |
| Point-delta before/after | `brenna-06/07`, `gale-02/03`, `vera-02/03`, and (same mechanism) `vera-01→vera-02`, `bellatrix-01→bellatrix-02` | `stat_points_available` is `0` on every post-wipe hero — no zero-point "before" state exists | One hero exported at points-reset, then again after +5 in one stat |
| Ability toggle | `dara-05-olho-0` / `-olho-10` | One snapshot cannot hold two ability levels for the same hero | One hero exported at `olho_clinico` 0, then again at 10 |
| Gear swap | `brenna-01` / `brenna-03` | One snapshot cannot hold two loadouts for the same hero | One hero exported with one gear slot swapped |
| Ability-slot coverage | `bellatrix-02-pts-each-1.json` (13 owned codes) | The new corpus's 8 payload heroes own 11 distinct codes. (This cell used to add "no hero owns `golpe_brutal` at all" — false since 2026-08-18: four captures carry it.) | Any account owning the missing codes |
| Dead ability points | `bellatrix-02-pts-each-1.json` (Bram L49 Incomum → 9 dead) | No post-patch corpus hero exceeds `quota × 20` | A low-rarity hero above level 40 |
| Pre-`birth_stats` whole-file reject | `gale-01-points-reset.json` (16 heroes, 0 with `birth_stats`) | Every post-patch export carries `birth_stats` on every hero by construction | Not restorable — the field predates the keystone patch entirely |
| High-phase mitigation | `phase-151.json` | `max_phase` caps at 42 post-wipe | Out of scope — `AD-061` accepts this loss permanently; see §4 |

## 6. What replaced the point-delta family, and its one residual gap

`packages/domain/tests/point-roundtrip.test.ts` (T4, `AD-071`, both trees) — a new, stronger
claim than the deleted before/after family. **The non-circularity argument in full:** the game
observes each hero's `stats` object directly and writes it into the export. That is a game
observation, not our output — `@bombfarm/domain` has to *land on it*. The forward chain
(`nakedFromBirth` → `applyPoints` → `applySkillTree`, wired as `composeSheetFromBirth`) consumes
`inferSpentPoints`'s recovered point split only as an intermediate; the split is never the
assertion target. `AD-068` is satisfied: the expected value in every comparison is the game's own
reading, never our own model's output pasted back in.

The bar (`AD-071`, measured, not assumed): literal bit-exactness (`Object.is` on every hero) is
unachievable — residuals of ~1e-15 to ~4e-12 from IEEE-754 association order differing between
the game's own accumulation and this forward chain's. Four claims instead, together stronger than
either a bare `Object.is` or a bare tolerance: (A) all 13 heroes have zero inference issues — it
was 12 of 13 until the flat-crit-damage fix resolved the 13th (§7); (D) Bellatrix L42's
crit-damage split is pinned exactly; (B) the round trip lands within `SHEET_ABS_TOL` (1e-6)
for every issue-free hero — measured max |Δ| 4e-12, six orders of magnitude of headroom; (C) at
least 2 heroes match bit-exactly (`Object.is`, all 8 keys) — measured exactly 2 (payload →
Bellatrix L27, Lyra L3).

**The residual gap, accepted and not designed around:** a round trip cannot in general
discriminate between two different point splits that both reproduce the observed `stats`. That is
an ambiguity in *inference*, not an error in *application*. It is narrower coverage than the
deleted before/after fixtures gave (which pinned a single point's marginal value directly), and no
task in this feature closes it. §7 records one case that LOOKED like that gap and was not.

## 7. The "known inference ambiguity" — RESOLVED

**Was:** `save-20260813-5heroes.json` → **Bellatrix L42**: `inferSpentPoints` returned
`{ kind: 'nonIntegerPoints', key: 'critDmg', raw: 1.8867078294204, residual: 0.1132921705796 }`.
Rounding to 2 points and forward-composing landed at `critDmg` 76.8534 vs. the observed 76.2530 —
Δ = 0.60 (all her other keys matched to ≤ 3.9e-12). Recorded as a real game observation the model
could not split, pinned rather than fixed, and flagged "worth a second look … if `critDmg`
modelling changes".

**It was a modelling error, not an ambiguity.** Crit-damage stat points are **flat** — `+5` planner
percentage points each, the same for every hero — not 8% of the hero's roll. Two heroes settle it,
each holding exactly 2 crit-damage points (pinned by their budgets: every other stat solves to an
exact integer, and `level − stat_points_available` leaves exactly 2):

| Hero | crit-damage roll | observed sheet Δ | Δ if 8% of roll |
| --- | --- | --- | --- |
| Bellatrix L42 (`save-20260813-5heroes.json`) | 66.252971472748 | **10.0** | 10.6005 |
| Fenn L49 (account 11882, captured 2026-08-15, not committed) | 67.127583786901 | **10.0** | 10.7404 |

Same Δ off different rolls ⇒ flat, and `10 / 2 = 5`. With `POINT_GAIN.critDmgFlat` Bellatrix
solves to exactly 2 with zero issues, and all 13 corpus heroes are issue-free. The fixture was
never edited — the model moved to meet it, which is the direction `AD-068` requires.

The same unit error sat in the Golpe Brutal ability (`+4` flat per level, not 4% of the roll); see
`packages/domain/tests/points-within-level-budget.test.ts` for the level-ceiling invariant that
now guards both.

## 8. The keystone-identifier handoff number

`tools/fixture-corpus-parity.test.mjs`'s `KEYSTONE_IDENTIFIER_HANDOFF_COUNT` constant is the
number F2's own exit is measured against. **Recorded finding:** the design's literal five-surface
description (every match must fall inside `packages/domain/src/**`, `apps/web/src/**` non-test,
`apps/desktop/**`, `packages/ui/**`, `apps/web/e2e/**`, or the two named F2 suites) is
unachievable as a hard per-match assertion — measured, dozens of pre-existing, non-quarantined,
non-corpus test files (`advisor-pipeline.test.ts`, `storage-abisso-base-compat.test.ts`,
`tree-guards.test.ts`, the `team-plan-*` suites, and others) legitimately test still-shipping
keystone functionality with synthetic (non-fixture) data. `F1` never touches
`packages/domain/src`, so that functionality and its coverage are correctly untouched. The guard
therefore asserts **total-match stability across the whole tracked tree**, failing in either
direction — the operative part of MFR-15 AC-4 — rather than a narrower, permanently-red
per-surface check. `validation.md`'s author must re-derive this number independently before
reading the committed constant.

## 9. The crit-chance/CDR shape reverted twice in five days (issue #132)

The 2026-08-15 patch moved crit chance and cooldown reduction from percent-of-base to flat
addends (commit `0418a82` / PR #102), and the 2026-08-18 patch — three days later — moved both
back to percent-of-base, rescaling the item catalog's `crit`/`cooldown` bases by the same factor
in the process. Today's model (percent-of-base, matching the shape this corpus originally
documented before 2026-08-15) is a genuine round-trip in SHAPE but not in every MAGNITUDE: crit
chance's per-point rate returned to its pre-2026-08-15 value (`0.02`), while cooldown's did not —
it is `0.02` now, HALF the pre-2026-08-15 `0.1`. See `POINT_GAIN` in
`packages/domain/src/model/rarity-constants.ts` for the full measurement and the wiki-mirror
corroboration.

**Deleted 2026-08-25** (they were first retired as non-subjects of the level-budget invariant,
then removed outright): `save-20260816-8heroes.json`, `save-20260816-respec-cdr-crit.json`,
`save-20260816-9heroes-redistrib.json`, `save-20260816-5heroes-gear-cdr-crit.json` and
`save-20260817-11heroes.json`. All five were captured inside the three-day flat-regime window or
immediately before it, so none of them solve under today's percent-of-base model — the same "no
single model reproduces both this file and the current game" reasoning §5 and §6 already apply to
the pre-2026-08-15 captures. Once every sheet-math suite had excluded them by name, what remained
was structural coverage (hero shapes, gear shapes, inventory, roster size), and the four
current-regime captures below carry all of it on larger rosters.

RECORDED LOSS, per this document's own rule that a deletion is written down rather than silently
taken: the before/after point-delta respec pair, the ITEM half of the flat crit/CDR matched-pair
argument, and the post-redistribution catalog as live data. The full record — provenance,
committed SHA-256s, and what each file proved — is in the corpus README's
`RETIRED — the five 2026-08-16 / 2026-08-17 captures` section. None of the shipped model rests on
them: every constant they established has since been re-measured under the current regime or is
superseded by the revert.

Their removal also settled a mis-diagnosis worth recording. Running today's `inferSpentPoints`
over these files recovers more points than several heroes' levels allow — up to 109 on a level-42
hero — which had been read as the captures themselves carrying heroes that over-spent. **A hero can
never spend more points than its level, and none of these did.** Every affected hero carries
`stat_points_available: 0`, the game's own statement that it has spent exactly its level: Minato is
level 42 with nothing unspent, so the game says 42 and the inversion says 109.

What over-spends is the INVERSION, which makes it a defect in the sheet math rather than in the
data — today's model against an older regime's capture, with the excess landing in `critChance`,
`cdr` and `penetration`, exactly the columns these patches reshaped, and a `PointInferenceIssue` on
every affected hero. It is not harmless: an over-recovered vector is wrong information, and PR #183's
Respec Advisor budget escape was one flowing out into a recommendation.
`points-within-level-budget.test.ts` now asserts the form of the invariant that survives a regime
change — an inversion reporting NO issue never exceeds the ceiling — over the whole fixture tree,
with no exclusion list.

**Added, the new sheet-math anchor pair:**

- **`save-20260818-12heroes.json`** — account 486, phase 51, 12 heroes, the first whole-roster
  witness for the reverted percent-of-base shape (zero inference issues, every budget exactly on
  `level`). Isolates the tree term (four item-free, ability-free heroes) and the `olho_clinico`
  ability term (three rank-20 heroes, each landing on exactly 6/7 after tree + gear) separately.
- **`save-20260819-respec-crit-cdr.json`** — the same account ~2 hours later, with Sora
  respecced from 10 attack points into 5 crit chance + 5 cooldown. The per-point-rate witness:
  no items, no crit/cooldown ability, so her whole move is the two stat-point terms, both
  `+0.1` for 5 points — `0.02` per point for both stats.

The flat-crit-cdr shape test (`packages/domain/tests/flat-crit-cdr-shape.test.ts` and its web
twin) is inverted, not deleted: it now discriminates percent-of-base FROM flat, using the same
matched-pair argument in reverse — identical gear/ability/tree inputs must produce EQUAL deltas
under a flat model and PROPORTIONAL (to the birth roll) deltas under percent-of-base, and the
2026-08-18 capture shows the latter.

## 10. Four properties added on top of the F1 corpus, and one gap they exposed

Four gaps stood between the corpus as F1 left it and a corpus that (a) keeps a structural test
from failing when a capture's numbers age out, (b) makes a stale-numbers value assertion expire
loudly instead of quietly passing, (c) bounds and inventories every capture family the same way,
and (d) proves a derived (non-captured) fixture still matches the command that produces it.

**(a)/(b) — `packages/domain/tests/helpers/capture-regime.ts`.** A single, reusable primitive: a
value-asserting test names the capture it reads and the regime boundary its numbers depend on
(`skipIfBefore(ctx, fixtureName, regimeBoundary, reason)`), and the test skips itself — loudly,
with the capture's own date in the message — the moment that boundary is not yet met. It replaces
no existing test (this repo's regime boundaries do not collapse to one date — see §9 above and
`points-within-level-budget.test.ts`'s own exclusion list — so a blanket retrofit would misclassify
some suites); it is the primitive a NEW value-asserting test should reach for, proven against a
real capture in `capture-regime-expiry.test.ts`. Calling it is also what makes a value test
IDENTIFIABLE as one, separate from a structural test reading the same fixture that calls neither
it nor asserts a specific number.

**(c) — `farm-rate-fixture-corpus.test.ts` and `fixture-corpus-bounds.test.ts`.** The completeness
guard `fixture-corpus.test.ts` already ran for `sheet-math/` (every capture has a README row,
every row names a file that exists, every row's digest matches) now also runs for `farm-rate/`,
the one other directory holding real external captures under the same README shape. A second
guard bounds the set of directories that may hold one: any committed file named with the corpus's
own `save-YYYYMMDD-`/`payload-YYYYMMDD-` convention must live inside a directory this guard
declares governed, so a capture landing in a new, uninventoried directory fails by construction
instead of by nobody noticing.

**(d) — `tools/derived-fixture-drift.test.mjs`.** Imports `buildFixtures()` from
`packages/game-api/scripts/generate-domain-fixtures.mjs` (refactored to expose that function
without writing anything on import) and diffs its in-memory output against the six committed
`packages/domain/tests/fixtures/api/*.json` files byte-for-byte. Turning this on surfaced a real,
pre-existing gap rather than a hypothetical one: five of the six committed files had drifted from
the generator days before this guard existed — the route projection gained hero `rarity`/`stars`/
`skin` fields the committed fixtures predate — invisible until this guard read them side by side.
That drift is a live, open finding as of this guard landing, not something this feature corrects:
regenerating the committed files could conflict with the pinned duplicate this document's §1
describes (`assembled-payload-before.json` == `sheet-math/payload-20260812-8heroes.json`), which
is a call for whoever owns that pin, not a rule this guard enforces itself.

## 11. Capture regime, made mechanical (issues #137, #171, #206)

§9 and §10 record the same problem twice from two directions: the game reshaped sheet arithmetic
four times in ten days, every patch left another capture behind, and *which* captures were still
admissible lived in prose and in one hand-maintained list inside a single test file. Nothing
stopped a retired capture from feeding a different suite whose assertions ran through the very math
it could no longer support, and nothing answered "is this fixture still admissible?" without
redoing the regime analysis by hand.

### 11.1 The registry

`packages/domain/tests/helpers/capture-regime.ts` now carries three declarations and the functions
that read them:

- **`REGIME_BOUNDARIES`** — every balance patch that reshaped sheet arithmetic, and what it moved.
  The only place a boundary date is written down.
- **`MECHANICS`** — what a value assertion can be *about* (`critChance`, `critDamage`, `cooldown`,
  `itemStats`, `sheet`), each pointing at the boundary its numbers must be at or past. `sheet` is
  the catch-all and the strictest, because a composed hero sheet folds in every other mechanic;
  anything derived from one — throughput, ranking, team plans, respec advice — asks for it.
- **`CAPTURE_REGISTRY`** — one row per committed capture: the date, whether it may still be the
  source of a number, any waiver, and what it is retained for.

A suite names the mechanic its numbers depend on and gets that mechanic's boundary. It never
repeats a date, so the next patch is one edit in the registry rather than a sweep of every suite.
`skipUnlessInRegime(ctx, capture, mechanic)` skips a single test loudly; `assertInRegime(capture,
mechanic)` throws, and is what a module-scope fixture choice uses — there is no test to skip yet at
that point, and defaulting to "run anyway" is exactly the quiet pass the mechanism exists to
prevent.

### 11.2 The structural / value split is the whole design

A capture leaving its regime does not stop being a real account. Its hero shapes, gear shapes,
inventory and team-plan inputs are as true as the day it was taken, and roughly fifty structural
suites read it for exactly those. What expires is only the arithmetic. So an out-of-regime capture
stays committed and stays readable, and what the registry withdraws is its admissibility as the
*source of a number*.

### 11.3 Waivers are verified, not trusted

A capture can predate a boundary and still be untouched by it. `save-20260819-11882-7heroes.json`
is the case: the 2026-08-23 patch restated two named abilities, and no hero on that roster owns
either, so the boundary cannot reach it. That is written as a `waivers` entry — and
`capture-regime-registry.test.ts` re-derives the precondition from the capture's own heroes and
fails if it does not hold. Corroborating evidence, measured before the waiver was granted: all
seven heroes recover **exactly `level`** points with zero inference issues, and the capture's
`stat_ranges` for Comum/Incomum/Raro are byte-identical to the 2026-08-23 and 2026-08-25 captures'.

### 11.4 The retention rule

Stated as a number, in `capture-regime-registry.test.ts`: at most **nine** out-of-regime captures
may be retained. A capture that has left its regime is kept only while a structural suite still
reads it — the orphan sweep in `fixture-corpus.test.ts` holds it to that — and adding a tenth fails
the bound rather than passing review unnoticed. Retiring one, or raising the bound, is then a
deliberate edit with a reason recorded here.

The registry's own completeness is enforced in both directions: a committed capture with no row
fails, and a row naming a deleted file fails. What counts as a capture is mechanical — a committed
fixture JSON carrying a `heroes` array, whatever directory it sits in and whatever it is named,
with `rejection/` excluded because those two files exist to be *rejected* rather than to record an
account.

### 11.5 Two captures added

- **`save-20260819-11882-7heroes.json`** — a second, disjoint account, and the **only in-regime
  capture that is not account 486**. Seven heroes (five geared, two naked; three rarities), all
  accepted with zero skips and zero warnings, wearing 40 items between them. That cross-account
  property is what the re-enabled optimizer findings rest on: a band holding on two unrelated
  accounts is evidence about the model rather than about one player's build. It also carries
  `fortuna` at two different ranks on one roster (Ivo 20/20, Gale 8/20), which no other capture
  does, so a per-rank claim about the gold multiplier can be read off real heroes rather than
  `withAbilityLevels` mutations.

  **Two claims made about this capture were wrong and are retracted here rather than quietly
  edited.** It was described as the corpus's first `golpe_brutal` witness: false — five captures
  carry the ability, the earliest being `save-20260818-12heroes.json` (Doran L55), which #209
  established independently while this work was in flight. And it was described as the first
  roster with a House that *binds*: also false — `casa.slots` is below the roster size on nearly
  every capture, and the retired 2026-08-13 export is more contended (3 slots / 5 heroes) than this
  one (5 / 7). Neither error changed a test; both were prose asserting a distinctiveness the
  measurement does not support.
- **`save-20260825-11heroes-one-shot-spread.json`** — the one-shot **spread**: nine geared
  late-level heroes that one-shot a phase-42 prop and two naked young ones (Hale L2, Joric L5) that
  do not. The only committed capture holding both sides of that contrast, which is what issue #171
  needed.

Their arrival also un-narrowed `points-within-level-budget.test.ts`'s corpus sweep, which the
2026-08-23 patch had reduced to one capture and thirteen heroes — a guard one deletion from
vacuous, as its own header said. It is three captures and thirty-one heroes now.

### 11.6 What was re-asked, what reproduced, and what did not

The disabled tests were not re-recorded. Each finding was re-asked of an in-regime capture first,
and only re-enabled if it still held. These reproduced on a **different account**, with their
recorded bands unchanged, which is what makes them evidence rather than a rubber stamp:

| Finding | Retired 2026-08-13 roster | 2026-08-19 roster |
| --- | --- | --- |
| all-attack scores below the current build | 212,284 < 264,997 | 1,085,794 < 1,331,738 |
| all-attack is the worst of the four builds | yes | yes |
| `gainPct` inside the recorded band [4, 9] | ~6.19% | 7.21% |
| chest ratio inside [1.3, 1.5], ruling out the PRD's 4x | ~1.40x | 1.426x |
| the chests objective costs gold (`paybackHours` null) | 259,413 < 264,997 | 1,137,440 < 1,331,738 |
| `goldGainPct` is negative, not clamped to 0 | negative | -14.59% (chests +42.64%) |

Three did **not** reproduce, and are recorded as losses in the files that carried them rather than
weakened quietly:

- **An infeasible row carrying the highest nominal rate is still not picked.** That discrimination
  was a property of an early account weak enough that its best-paying phase was one it could not
  clear. Measured on both in-regime captures: best feasible 1,331,738/h against best infeasible
  574,153/h, and 31,862,424 against 3,446,961. Weakening the roster does not create the case either
  (measured across attack factors 0.5 down to 0.01) — the infeasible boundary and the peak move
  together. What is left is the claim without the discrimination.
- **The 26-34 gold-pick band.** A property of one account's strength. What both accounts agree on,
  and what is asserted instead, is the direction: chests pick phase 1, gold picks strictly deeper.
- **Re-rank moves the board's top-by-gold phase.** On a maxed-out account the proposed build is
  worth ~7% more *at the same phase*, so the argmax does not move. The weaker claim in its place is
  that re-rank re-prices the board at all.

### 11.7 The worklist is finished

All 58 are resolved. `F8_SKIP_MANIFEST` is empty in both manifests
(`tools/fixture-corpus-parity.test.mjs` and `packages/domain/tests/source-surface.test.ts`), and
every skip left in the tree is a deliberate one declared in `SKIPS_NOT_F8`:

- `apps/web/e2e/visual.spec.ts` (3) — a whole-suite `describe.skip`, held until its screenshot
  baselines are reviewed. Its own header carries the re-enable step.
- `apps/desktop/renderer/lib/planning/recompute-budget.test.ts` (1) — **reclassified**, not
  resolved. Its skip is a red-state demonstration that deliberately loops the roster 80x to blow
  the budget its siblings assert; its own comment says it "is not itself a regression guard, it is
  evidence the regression guard has teeth". It was never stale-fixture debt.

The last four resolutions were not re-points, and each is worth naming:

- **Two frozen refactor-parity artifacts were DELETED**, with their tests:
  `fixtures/farm-basis-parity-expected.json` (a literal `computeHeroFarmFacts` output plus the
  whole 600-row `computeFarmRates` table) and `fixtures/invariance/baseline.json` (~2791 scalars).
  Each was recorded to prove that ONE refactor or deletion was output-preserving. Both shipped, and
  the model has moved repeatedly since — the invariance baseline had been re-recorded seven times
  chasing it — so neither could match, and re-freezing them would have proved nothing about what
  they were recorded for. What survives in both files is the set of SELF-comparisons, which never
  needed a frozen artifact and do not expire with a regime. Their per-patch footprint logs, which
  is the part worth keeping, are §12 below.
- **`api-payload-parse`'s "every candidate is unblocked" was deleted rather than re-pointed.** The
  four `api/assembled-payload-*.json` files are generated from one 2026-08-12 account, four of
  whose eight heroes the importer now refuses, so no edit to that suite could make the claim true.
  What replaced it is the claim that survives a regime change and matters more at that seam: a
  hero the model cannot invert is refused LOUDLY, with a reason, and is never silently dropped
  from the candidate list nor handed on still carrying a spent-point vector.
- **Two SYNTHETIC fixtures had drifted the same way as the captures**, which is the finding this
  section exists to record. `apps/web/e2e/fixtures/sample-save.json` was blocking **2 of its 3
  heroes** (Cora recovered 136 points against a budget of 0, Brenna 23) — which is why so many
  browser specs about importing had nothing to assert on — and `import-save.test.ts`'s own
  `baseSave()` blocked its Brenna for the same reason. Both were recomputed by feeding
  `composeSheetFromBirth` each hero's own birth/level/stars/loadout/tree with an all-zero point
  vector and converting back to save units via the single shared conversion table. Every hero now
  imports with zero issues.
  The useful negative on the synthetic Brenna: `energia`, `speed`, `cooldown_reduction` and `luck`
  came back byte-identical, so the drift was in the attack level curve, the crit-chance and
  crit-damage tree terms, and Ponta de Diamante's penetration, and nowhere else.

**A capture is not the only thing that can go stale.** A hand-written fixture claiming a stat sheet
its own point budget cannot pay for is the same defect wearing different clothes, and it hid longer
because nothing about it looked like a capture. The registry cannot reach these — they carry no
capture date and record no account — so what catches them is the importer refusing them, and what
makes that visible is a test that asserts nothing is blocked.

### 11.9 What the browser specs needed

Twelve `apps/web/e2e/**` specs were disabled. Six came back on the `sample-save.json` fix alone.
The other six needed a seed with real gear on it: `teamPlanFixtureSeed` reads the 2026-08-13
capture, which yields 3 heroes of 5 and every one of them wearing **nothing**, so a gear planner
was being driven against a roster with no item to keep, move or forge.

`teamPlanRichSeed` was added beside it (7 of 7 heroes, 40 items worn, 54 in the bag, a binding
House) and the forge, kept-item, saturation, search-budget and cancel specs moved onto it. The two
seeds are kept separate deliberately: the 2026-08-13 roster has two heroes called Perrin, and that
duplicate-name case — which the accessible-label and scope specs are built around — exists on no
other committed capture. Swapping it out wholesale would have traded one set of disabled specs for
another.

One further fix was not a fixture problem: the loadout-drift spec searched the whole disclosures
panel for a hero name, and the richer roster raises a second disclosure that also happens to name a
hero, so the search matched two elements and failed strict mode. It is now scoped to the drift
paragraph itself, which is what the claim was always about.

### 11.10 Re-recording histories moved out of the test files

Two long re-recording logs described the retired 2026-08-13 roster and would have been misleading
carried onto a different capture, so they are kept here instead.

**`farmObjectiveScales` on `save-20260813-5heroes.json`** (`farm-optimize-objective.test.ts`), each
step a model change rather than a wrong number: pre-#86 gold 264,997.32 / chests 2.0490; + House
ceiling 247,444.39 / 1.7474; + cadence fix 180,744.87 / 1.2806; + the 2026-08-18 crit/CDR revert;
+ rotation-priced team auras and the `HOP_DENSITY_EXPONENT` refit; + the additive drain-reduction
fix; + the 2026-08-23 crit-chance ability shape (gold to 184,616.99); + the FIFO field queue, which
moved **both** scales by the same 0.087% (184,616.99 to 184,456.14 and 1.27461 to 1.27299). A note
in that file had claimed `chestScale` was a per-prop figure and therefore invariant to clear speed;
it is `chestPick.row.chestsPerHour`, a per-hour figure exactly like `goldScale`, and the correction
is recorded here so it is not re-derived a third time.

**The DPS golden rankings** (`points-rank-golden.test.ts`, both trees) were re-recorded for the
House cycle table correction — where only `energy` moved on every subject, and `attack`,
`critChance`, `cdr` and `speed` stayed byte-identical, which is what proved it a duty-cycle change
touching no per-point rate — and again for the 2026-08-18 revert, where `critChance` and `cdr`
moved in both directions and *re-ordered* on every subject, with `critDmg` following as a
second-order effect through `critFactor`'s coupling.

## 12. The two deleted frozen artifacts, and what they recorded

Both were deleted in the pass described in §11. Each existed to prove one change was
output-preserving; each was then re-recorded repeatedly as the model moved underneath it. The
numbers are gone, but the FOOTPRINTS are the part worth keeping — each entry says which columns
moved for which change and, just as usefully, which did not, and that is evidence about how the
model is coupled rather than about the artifact.

### 12.1 `fixtures/farm-basis-parity-expected.json`

Verbatim, as it stood in `farm-basis-parity.test.ts`'s header at deletion:

Proof that the `farm-rate.ts` basis seam is a byte-identical refactor, not a rewrite.

RE-RECORDED 2026-08-24 for the FIFO field queue. `concurrencyScale` was
`min(1, fieldSlots / heroesOnField)` — a MEAN compared against the cap, which charges nothing
whenever the average fits, however often the peaks do not. The game admits heroes to the field
FIFO by who finished resting first, and that rule is identity-blind, so the served share
`E[min(fieldSlots, X)] / E[X]` needs no assumption about who takes a freed slot. `min` is
concave, so the old form could only ever run optimistic.

Footprint: `heroFacts` byte-identical on all 5 heroes, and `heroesOnField`, `expectedHtk`,
`fortunaAura` and `fieldContentionPct` unmoved on all 600 rows — `heroesOnField` is still the
DEMAND (pre-queue), and only the scale applied to it changed. `concurrencyScale` and every
throughput column downstream of it moved on all 600 rows, by at most **0.12%**: this corpus is
5 heroes against 9 field slots, so its demand only just crosses the cap (scale 1 -> 0.9988).
The change is worth 6-7% on a roster whose field is genuinely contended, and exactly zero where
the field cannot fill — a 13-hero capture at 9 slots was the validation, not this one.

PREVIOUSLY RE-RECORDED 2026-08-23 for TWO changes landing together on one branch, re-recorded once on top
of the crit-chance capture below rather than merged into it.

1. `FarmRateRow.fieldContentionPct` — a new column, so it appears on all 600 rows and nothing
   else moves for it. It reports how OFTEN the field is full with a rested hero benched, and
   deliberately does not correct what that costs: the cost depends on which hero takes a freed
   slot and the game fixes no such rule. A version that did correct throughput was written,
   measured and dropped — it scored well against a simulation deploying the strongest hero
   first, which is an automation's behaviour rather than the game's, and read ~12% off once
   that assumption became uniformly-random deployment.
2. The gate boss's seconds. `propsPerHour` was `3600 × propsPerSec`, charging nothing for the
   boss even though `clearSecs` counts it and the boss drops no props — so a gate row's own two
   numbers described different clocks and every rate derived from `propsPerHour` read high by
   the boss's share of the cycle (~2% at the first gate, ~12% at 50 on this corpus).

Footprint, verified field by field: `heroFacts` is byte-identical on all 5 heroes.
`fieldContentionPct` is added to all 600 rows. Beyond that **only the 60 gate rows move, and on
them only the seven props-driven columns** — `propsPerHour`, `goldPerHour`, `chestsPerHour`,
`gemsPerHour`, `timePiecesPerHour`, `stoneChestsPerHour`, `xpPerHour`. All 540 non-gate rows are
untouched, and `clearSecs`, `cyclesPerHour`, `keysPerHour`, `heroesOnField`, `concurrencyScale`
and `expectedHtk` do not move on any row, gate included: the boss's seconds were always in
`clearSecs`; only the loot rates ignored them.

Non-gate rows are held bit-exact on purpose. `cyclesPerHour × propCount` is algebraically the
same value as `3600 × propsPerSec` off a gate, but the rearrangement is not bit-equal in
IEEE754, so the production expression branches on `line.gate` rather than being simplified.
A diff here that touches a non-gate row means that branch was flattened.

PREVIOUSLY RE-RECORDED 2026-08-23 for the crit-chance ability shape (Olho Clínico and Presságio Mortal
restated in flat crit POINTS) and, on the gate rows only, the refreshed stone/time chest rates.
Diffed field by field against the previous capture:

- `heroFacts` — exactly ONE field moved, `avgHitBase`, and only on the 2 of 5 heroes carrying
  Olho Clínico (Bellatrix and Jon, both rank 20). That is the whole correct footprint: the
  ability is a crit-chance term, crit chance reaches throughput only through the average hit,
  and nothing else in `heroFacts` depends on it. `uptime` is byte-identical on all 5 — the
  load-bearing negative, since drain is untouched by this patch and an `uptime` move would mean
  the change had leaked into the energy path. `penetrationPct`, `fuseSecs`, `walkSpeedCells`,
  `cycleSecs`, `plantsPerSec`, `plantsPerSecByAto`, `blocksPerBomb`, `heroLuckPct`,
  `veiaOuroLevel`, `fortunaLevel` and `degenerate` are byte-identical too.
- `rows` — every throughput column downstream of the hit moved on the 580 reachable rows
  (row 42: 118,767 → 138,139 gold/hr, `clearSecs` 478.6 → 411.5 — a rank-20 Olho hero's crit
  rate goes from `roll + 43%` to `roll + 40 points`, so the squad clears materially faster).
  `stoneChestsPerHour` and `timePiecesPerHour` moved on all 60 GATE rows for a second,
  independent reason — the wiki refresh took the stone chest from 0.005% to 0.05% and the time
  chest from 0.15% to 0.1%; `gemsPerHour` moved on 59 of those from the clear-rate change
  alone, its own rate being unchanged. `heroesOnField` moved on only 4 rows, `mitigationPct`,
  `ato`, `gate`, `locked`, `oneShot`, `infeasible`, `itemLevels`, `itemLevelLabel`,
  `jaulaEarlyCapPct`, `jaulaWindowSecs`, `gateTimerSecs`, `fortunaAura` and `concurrencyScale`
  not at all.

RE-RECORDED 2026-08-21 for the additive drain-reduction fix: a hero's own drain reduction and
the team's used to be combined multiplicatively; measurement showed they add instead, each
capped at 20%, floored at a combined 60%. Jon is this corpus's only hero with both arms —
Bateria Extra rank 20 (self, capped at 20%) and Fôlego de Mineiro rank 18 (team, 18%) — so his
own combined rate moves from 0.8 × 0.82 = 0.656 to 1 − 0.20 − 0.18 = 0.62. Diffed field by
field against the previous capture:

- `heroFacts.uptime` moved on all 5 heroes: Jon's own move is the large one, and because
  auras are priced over the rotation (weighted by every hero's uptime), his slightly changed
  presence weight ripples a smaller, second-order move into the shared roster-wide Fôlego
  total the other 4 heroes read — none of whom carry a drain ability of their own.
  `avgHitBase`, `penetrationPct`, `fuseSecs`, `walkSpeedCells`, `cycleSecs`, `plantsPerSec`,
  `blocksPerBomb`, `heroLuckPct`, `veiaOuroLevel`, `fortunaLevel` and `degenerate` are
  byte-identical — the fix touches drain and nothing upstream of it.
- `rows` — every throughput column downstream of uptime moved on all 600 rows
  (`goldPerHour`, `chestsPerHour`, `keysPerHour`, `gemsPerHour`, `timePiecesPerHour`,
  `stoneChestsPerHour`, `xpPerHour`, `propsPerHour`, `cyclesPerHour`, `clearSecs`,
  `expectedHtk`, `heroesOnField`). `mitigationPct`, `ato`, `gate`, `locked`, `oneShot`,
  `infeasible`, `itemLevels`, `itemLevelLabel`, `jaulaEarlyCapPct`, `jaulaWindowSecs`,
  `gateTimerSecs`, `fortunaAura` and `concurrencyScale` are byte-identical.

RE-RECORDED 2026-08-20 for two changes at once — team auras priced over the ROTATION rather
than off the deployed line-up (`computeTeamBuffsOverRotation`), and the `HOP_DENSITY_EXPONENT`
refit (0.5 → 0.124). Diffed field by field against the previous capture:

- `heroFacts` — exactly two fields moved, one per change. `uptime` rose on all 5 heroes
  (Jon 0.2505 → 0.2607, Bellatrix 0.3187 → 0.3304) because this corpus is the MIRROR case of
  the defect: its `account.teamBuffs` is all-zero (no hero is deployed), yet Jon carries Fôlego
  de Mineiro rank 18 and sits in the rotation pool, so the board used to grant the roster none
  of an aura it genuinely runs on for a quarter of every rotation and now prices it at 5.21.
  `plantsPerSecByAto` moved on all 5 from the exponent refit. `avgHitBase` did NOT move, which
  is the load-bearing negative: no hero in this corpus carries Grito de Guerra, so the aura
  change must not touch a damage term here — and it does not.
- `rows` — every throughput column moved on all 600 rows (row 42: 113,791 → 118,196 gold/hr,
  clearSecs 499.57 → 480.95), as both changes reach throughput. Every structural column
  (`mitigationPct`, `ato`, `gate`, `locked`, `oneShot`, `gateTimerSecs`, `jaulaEarlyCapPct`,
  `jaulaWindowSecs`, `phase`, `itemLevels`, `itemLevelLabel`, `concurrencyScale`,
  `fortunaAura`) is untouched. `concurrencyScale` staying put confirms the field cap is still
  not binding on this corpus; `fortunaAura` staying put confirms no hero here carries Fortuna.

RE-RECORDED 2026-08-19 (second pass) for issue #132's team-aura roster shape. This fixture's
`account.teamBuffs` is `zeroTeamBuffs()` (farm-rate-fixtures.ts reproduces production's
post-import default, before the team-buffs auto-fill button is ever pressed), and Jon (the
corpus's only Fôlego de Mineiro carrier, rank 18) previously had his own rank silently boost
his own drain regardless of that zero — the exact double-count the fix removes. Diffed field
by field against the previous capture:

- `heroFacts` — ONLY Jon's own `uptime` moved (0.2896 → 0.2505); every other per-hero field,
  on Jon and on the other 4 heroes, is byte-identical. That is the correct footprint: uptime is
  the one heroFacts field drain touches, and drain is per-hero.
- `rows` — every throughput column moved on all 600 rows, because `heroesOnField` (the
  squad-level House allocation) is a function of every hero's uptime together — Jon's own drop
  ripples into the whole squad's concurrency split even though the other 4 heroes' own facts
  did not move. Every structural column (`mitigationPct`, `ato`, `gate`, `locked`, `oneShot`,
  `gateTimerSecs`, `jaulaEarlyCapPct`, `jaulaWindowSecs`, `phase`, `itemLevels`,
  `itemLevelLabel`, `concurrencyScale`, `fortunaAura`) is untouched.

RE-RECORDED 2026-08-19 for the crit-chance/CDR revert (issue #132 — the 2026-08-18 patch put
both back to percent-of-base, three days after the 2026-08-15 patch that made them flat).
Diffed field by field against the previous capture before rewriting:

- `heroFacts` — `avgHitBase`, `fuseSecs`, `cycleSecs`, `plantsPerSec` and `plantsPerSecByAto`
  moved on some/all of the 5 heroes — every one of them downstream of the hero's crit
  multiplier, which is exactly what changed. No field unrelated to combat throughput moved.
- `rows` — every throughput column moved on all 600 rows (`goldPerHour`, `chestsPerHour`,
  `keysPerHour`, `xpPerHour`, `propsPerHour`, `cyclesPerHour`, `clearSecs`, `expectedHtk`,
  `gemsPerHour`, `timePiecesPerHour`, `stoneChestsPerHour`), plus `heroesOnField` (the House
  allocation re-ranks slightly when hero throughput moves). Every structural column —
  `mitigationPct`, `ato`, `gate`, `locked`, `oneShot`, `gateTimerSecs`, `jaulaEarlyCapPct`,
  `jaulaWindowSecs`, `phase`, `itemLevels`, `itemLevelLabel`, `concurrencyScale`,
  `fortunaAura` — is untouched, which is the signature of a damage-model change and not a
  table change.

PREVIOUSLY RE-RECORDED 2026-08-18 for the per-ato hop-density rescale (`hopScaleForAto` — `HOP_DISTRIBUTION`
is measured at ato 1's 50 props and was previously applied unscaled to every ato). Diffed field
by field against the previous capture before rewriting, and the footprint is exactly the change:

- `heroFacts` — **only the new `plantsPerSecByAto` appeared**; every pre-existing field on all
  5 heroes is byte-identical, `cycleSecs` and `plantsPerSec` included. Those two are defined at
  the fit ato, so the rescale cannot move them — that is what makes them the control here.
- `rows` — **ato 1's 50 rows are byte-identical, every column.** Ato 1 IS the measurement, so a
  diff there would have meant the rescale was not identity at its own fit point. The other 550
  rows move on the throughput columns only (`clearSecs`, `propsPerHour`, `cyclesPerHour`,
  `goldPerHour`, `chestsPerHour`, `keysPerHour`, `gemsPerHour`, `timePiecesPerHour`,
  `stoneChestsPerHour`, `xpPerHour`, and `expectedHtk` — the last because the House allocation
  re-ranks slightly when plant rates do). `clearSecs` falls by a single factor within each ato:
  x0.9101 at ato 2, x0.8635 at ato 3, x0.8188 at ato 4, x0.7986 at ato 5 — monotone in prop
  density and flat within an ato, which is the shape a geometric rescale must have. Anything
  varying inside one ato would have meant a phase-dependent term had leaked in.
- `mitigationPct`, `ato`, `gate`, `locked`, `oneShot`, `gateTimerSecs`, `jaulaEarlyCapPct`,
  `jaulaWindowSecs`, `phase`, `itemLevels`, `itemLevelLabel`, `heroesOnField`,
  `concurrencyScale` and `fortunaAura` are byte-identical on all 600 rows.

PREVIOUSLY RE-RECORDED 2026-08-18 for the item-drop-band refresh (`ITEM_POR_FASE` re-cut by the 2026-08-15
patch from 9 bands topping out at item level 90 to 30 running 10…300). Diffed field by field
against the previous capture before rewriting, same discipline as every re-record below, and
the footprint is exactly the change:

- `heroFacts` — **byte-identical, all 5 heroes, every field.** The item level is not an input
  to any hero quantity.
- `rows` — **only `itemLevels` and `itemLevelLabel` moved**, on 580 of 600 phases. The 20 that
  did not are phases 1–20, where both the old and the new first band answer `[10]`. Every
  other column, including every throughput column, is byte-identical: `goldPerHour`,
  `chestsPerHour`, `keysPerHour`, `gemsPerHour`, `timePiecesPerHour`, `stoneChestsPerHour`,
  `xpPerHour`, `propsPerHour`, `cyclesPerHour`, `clearSecs`, `expectedHtk`, `mitigationPct`,
  `ato`, `gate`, `locked`, `oneShot`, `infeasible`, `gateTimerSecs`, `jaulaEarlyCapPct`,
  `jaulaWindowSecs`, `phase`, `heroesOnField`, `concurrencyScale` and `fortunaAura`. That an
  unrelated column would have moved is the whole point of the check — the item level is a
  display field, and a throughput diff here would have meant something numeric was reading it.

In particular this capture sits directly on top of the two XP/stone-chest recaptures below, so
it is also the check that the band refresh does not interact with them: `xpPerHour` and
`stoneChestsPerHour` carry their post-#128 values here, unmoved by the bands.

PREVIOUSLY RE-CAPTURED 2026-08-18, same day as the entry directly below, for the two gaps that entry's
own note flagged and deliberately left open: `xpPerHour` here still did not apply the
account's `skills.totals.xp_mult`, and the row carried no stone-chest term even though
`DROP_RATES` had grown a fifth member for it. Both are `SquadFarmFacts`/`FarmRateRow` additions,
not touches to any existing formula input, so the blast radius is narrow by construction:

- `rows[].xpPerHour` moved on **all 600 rows**, by exactly the fixture's own `xp_mult` (1.11 on
  the committed 5-hero capture) — every row's relative change lands in `[0.10999999999999997,
  0.11000000000000022]`, i.e. one constant factor, not a per-row drift. `heroFacts` has zero
  diffs: the multiplier is applied once in `buildRow`, downstream of every hero-level term.
- `rows[].stoneChestsPerHour` is a **new field**, not a moved one. On the 60 gate rows it is
  byte-identical to that row's own `gemsPerHour` (both drop at `DROP_RATES.stone ===
  DROP_RATES.gem === 0.00005`); on the 540 non-gate rows it is `0`. Zero mismatches either way.
- Every other field — `goldPerHour` included — is byte-identical to the previous capture.
  `goldPerHour` in particular does not move: neither change touches the gold multiplier chain
  (`teamCoinMult`, `fortunaAura`, `goldSelfMix`), which is exactly what the recorded account-486
  gold/hr calibration anchor (a separate fixture from this file's own) requires of any change
  that is not itself about gold.

Reconciled against a live capture held out of band, not in this repo: the same two witnesses
the entry below already cites (phase 51 wiki 167 → game 261, phase 60 wiki 194 → game 303) are
`wiki × 1.56`, and a live gate tooltip lists `Stone chest chance` at the same percentage as
`Gem chest chance` on the same phase — both confirm the shape fixed here, not just this
fixture's own arithmetic.

RE-CAPTURED 2026-08-18 for `xpPerProp()` switching from a linear `XP_FASE_INI`→`XP_FASE_FIM`
interpolation to the exact per-line `xpProp` integer every wiki phase line already carries (the
interpolation is now only a fallback for a phase with no line). This is a pure precision fix —
live tooltip witnesses at phase 51 (wiki 167, interpolated 166.7) and phase 60 (wiki 194,
interpolated ~193.98) confirmed the exact per-line value is what the game awards.

Diffed field by field against the previous capture: **only `rows[].xpPerHour` moved** — 598 of
600 rows (phase 1 and phase 600 are the interpolation's endpoints, so they already matched
exactly), max relative change ≈0.644%. `heroFacts` has zero diffs, and every other `rows[]`
field (`goldPerHour`, `chestsPerHour`, `keysPerHour`, `gemsPerHour`, `timePiecesPerHour`,
`propsPerHour`, `cyclesPerHour`, `clearSecs`, `expectedHtk`, `mitigationPct`, `ato`, `gate`,
`locked`, `oneShot`, `infeasible`, `itemLevels`, `itemLevelLabel`, `jaulaEarlyCapPct`,
`jaulaWindowSecs`, `gateTimerSecs`, `fortunaAura`, `heroesOnField`, `concurrencyScale`, `phase`)
is byte-identical — the signature of a change confined to XP and nothing else. Note
`xpPerHour` still does not apply the account's `skills.totals.xp_mult` here — that gap is
unchanged by this recapture and is tracked separately.

RE-RECORDED 2026-08-16 for the flat crit-chance/CDR change (`POINT_GAIN.critChanceFlat` /
`.cdrFlat`). The capture is of OUR OWN pre-change output, so re-recording it is the point of
the file, not a weakening — what matters is that the movement is explicable. Measured, field
by field:

- `heroFacts.avgHitBase` — 5 of 5 heroes, ≤1.77%. Crit chance is a smaller share of the
  average hit now, so every hero's base hit falls slightly. This is the ONLY heroFacts field
  that moved apart from `heroesOnField` (3 rows, ≤3.32%).
- `rows.*` — 591 of 600 phases on each throughput column (`goldPerHour`, `chestsPerHour`,
  `xpPerHour`, `propsPerHour` ≤10.58%; `keysPerHour`, `cyclesPerHour` ≤10.11%; `clearSecs`
  ≤9.18%; `expectedHtk` ≤9.57%), all downstream of the same lower hit. `gemsPerHour` and
  `timePiecesPerHour` moved on 59 rows (they are 0 on the rest).
- **Unmoved:** every structural column — `mitigationPct`, `ato`, `gate`, `locked`, `oneShot`,
  `infeasible`, `itemLevels`, `phase`. The shape of the table is untouched; only magnitudes
  downstream of crit moved, which is the signature of a damage change and not a table change.

`farm-basis-parity-expected.json` (tests/fixtures/) is a literal capture of the
`computeHeroFarmFacts(fixture)` output and the 600-row `computeFarmRates` table, so the
assertions below compare the code against frozen literals rather than against itself. Every
assertion uses exact `toEqual`, never `toBeCloseTo`, except the one case explicitly documented
as approximate (the moved-vector affine claim).

RE-CAPTURED at the flat-crit-damage fix (`POINT_GAIN.critDmgFlat`). Diffed field by field
against the previous capture first; the footprint is exactly the change and nothing else:

- `heroFacts`: **only `avgHitBase`, and only on Bellatrix** (index 4 — the one fixture hero
  holding crit-damage points). Her 2 crit-damage points used to read as
  `66.252971472748 × (1 + 2 × 0.08)` = 76.853…; flat they read as
  `66.252971472748 + 2 × 5` = 76.252971472748, which is what the game's own `stats` block
  says. Jon / Perrin / Perrin / Lyra are byte-identical on every field, and so are
  `penetrationPct`, `fuseSecs`, `walkSpeedCells`, `cycleSecs`, `plantsPerSec`,
  `blocksPerBomb`, `heroLuckPct`, `veiaOuroLevel`, `fortunaLevel`, `uptime` and `degenerate`
  on Bellatrix herself — in particular `cycleSecs` did NOT move, which is the proof this
  change left the cadence model (below) alone.
- `rows`: only the throughput-derived columns moved (`propsPerHour`, `goldPerHour`,
  `chestsPerHour`, `keysPerHour`, `gemsPerHour`, `timePiecesPerHour`, `xpPerHour`,
  `cyclesPerHour`, `clearSecs`, `expectedHtk`). `mitigationPct`, `ato`, `gate`, `locked`,
  `oneShot`, `infeasible`, `itemLevels`, `itemLevelLabel`, `jaulaEarlyCapPct`,
  `jaulaWindowSecs`, `gateTimerSecs`, `phase`, `fortunaAura`, `heroesOnField` and
  `concurrencyScale` are byte-identical — the fix touched one hero's average hit and nothing
  else.

PREVIOUSLY RE-CAPTURED at the cadence fix (cycle averaged over `HOP_DISTRIBUTION` instead of
`max(fuse, E_D_CELLS / w)`). Diffed field by field before rewriting, same as last time:

- `heroFacts`: **only `cycleSecs` and `plantsPerSec` moved** — and `plantsPerSec` is `1 /
  cycleSecs`, so that is one change, not two. `avgHitBase`, `blocksPerBomb`, `fuseSecs`,
  `walkSpeedCells`, `penetrationPct`, `uptime`, `heroLuckPct`, `veiaOuroLevel`,
  `fortunaLevel` and `degenerate` are byte-identical. Notably `uptime` did NOT move, which is
  the proof that this change touched cadence and left the House model alone.
- `rows`: only throughput-derived columns moved. `locked`, `mitigationPct`, `oneShot`,
  `infeasible`, `concurrencyScale`, `fortunaAura`, `ato`, `gate`, `gateTimerSecs`,
  `itemLevels`, `itemLevelLabel`, `jaulaEarlyCapPct` and `jaulaWindowSecs` are byte-identical.

A warning for the next person to re-record this: the table below is captured with
`computeFarmRates({ heroes, account })` and NO `maxPhase`. Passing one flips `locked` on every
row, which looks like a real regression in the diff and is purely a harness mistake.

PREVIOUSLY RE-CAPTURED at the House-recovery-slot / `casa.cycle_secs` / `field_slots` fix,
with the same discipline. That diff was:

- `heroFacts`: **only `uptime` moved.** `avgHitBase`, `penetrationPct`, `fuseSecs`,
  `walkSpeedCells`, `cycleSecs`, `plantsPerSec`, `blocksPerBomb`, `heroLuckPct`,
  `veiaOuroLevel`, `fortunaLevel` and `degenerate` are byte-identical to the pre-fix capture.
  `uptime` moved because the fixture's rest seconds now come from its own `casa.cycle_secs`
  (1181.05s) rather than the `HOUSES` table's interpolation (1102s) — a longer House cycle,
  so every duty cycle is lower. Nothing about the damage or cadence math changed, and this
  file's untouched columns are the proof.
- `rows`: only the throughput-derived columns moved (`propsPerHour`, `goldPerHour`,
  `chestsPerHour`, `keysPerHour`, `gemsPerHour`, `timePiecesPerHour`, `xpPerHour`,
  `cyclesPerHour`, `clearSecs`, `expectedHtk`), plus the two new ones (`heroesOnField`,
  `concurrencyScale`). `mitigationPct`, `ato`, `gate`, `locked`, `oneShot`, `infeasible`,
  `itemLevels`, `itemLevelLabel`, `jaulaEarlyCapPct`, `jaulaWindowSecs` and `gateTimerSecs`
  are byte-identical — i.e. the fix touched throughput and nothing else.


### 12.2 `fixtures/invariance/baseline.json`

Verbatim, as it stood in `invariance-baseline.test.ts`'s header at deletion:

The pre-deletion characterization baseline — an explicitly projected record with a
sign-preserving number encoder. The mechanism that makes
MP5's headline risk ("F2 edits fidelity-gated sheet math while deleting fields, and numbers
drift silently") assertable rather than reviewable: a committed pre-deletion recording of the
entire SURVIVING numeric surface, compared bit-exactly against every post-deletion commit.

Named `invariance-*`, deliberately never named after any deleted arm — a file
named after one would trip this feature's own absence guard (T10's `source-surface.test.ts`).

A decimal-digit-tolerance assertion style is deliberately never used in this file: it would
silently absorb exactly the class of drift this suite exists to catch (a 5e-3 error still
rounds "close"). A deep-equality assertion is never used for numbers either — it treats `0`
and `-0` as equal, which is the one corner this suite must not paper over. Every
numeric leaf in the record is pre-encoded by `encodeNumber` (sign- and precision-preserving),
so the top-level comparison is exact string equality on the canonical JSON serialisation, and
the walk below decodes leaves back to numbers for a same-value comparison (`Object.is`) only
to name the first differing hero/function/stat on failure.

RE-RECORDED (7) at the 2026-08-23 crit-chance ability shape. Olho Clínico and Presságio Mortal
went from percentages of the hero's crit-chance roll to FLAT crit points, and the flat term
sits outside the shared gear/points pool and outside the skill tree's base — see the
`critChanceFlat` ability kind for the capture that pins all three.

**142** of the 2791 recorded scalars moved, and **13** were renamed in place
(`computeCombatMults.teamCritPctOfBase` → `teamCritFlat`, one per hero) — the only key change,
and `meta.scalarCount` therefore did NOT move. Every moved value is either crit chance itself or
something reading it: the three Olho-bearing heroes' `critChance` on every sheet-shaped subject
(`naked`, `applySkillTree`, `composeSheetFromBirth`, `sheetsFromBirth`, `peelSheetStages`,
`peelSheetSources`, `derive.adjusted`/`effective`), the `buildStatBreakdown` crit-chance ledger
(whose ability step changed op from `×` to `+`), `derived.critFactor`, and the DPS/ranking
figures hanging off the crit multiplier (`derive.dps`/`active`, `pipelineForHero.dps`/`active`/
`ranking[].gainPct`/`best.gainPct`/`resetAdvice.*`, and the scorer's
`perHero[].sustained`/`active`/`objective`).

NOT moved, and the proof this was the crit-chance shape and nothing else: every OTHER sheet key
on every subject, every `inferSpentPoints` value on every hero, `avgHitBase`, and every hero
that carries no Olho Clínico rank at all. Both corpus files predate the patch, so their
crit-chance numbers are characterization values rather than a claim about today's game — the
capture that IS a claim is `save-20260823-13heroes-crit-points.json`, swept by
`point-roundtrip.test.ts` and `points-within-level-budget.test.ts`.

---
RE-RECORDED (6) at the Tier 1 reset-budget level clamp. `findGateCandidate` took
`budgetOf(pts)` un-clamped, so a hero whose inferred spend exceeds its level was handed more
points to re-place than the game can ever grant it — the same phantom-proposal failure the
`reoptBudget` clamp already closed for Tier 2, left open on the tier that actually drives the
reset panel. `resetBudget(pts, level)` closes it.

Exactly **14** of the 2791 recorded scalars moved, and every one is a `resetAdvice` field
(`gainPct`, `reoptDps`, `recommend`) on one of FIVE heroes — Bellatrix@27, Nyx@25 and Wren@24
in `payload-20260812-8heroes.json`, Jon@38 and Bellatrix@42 in `save-20260813-5heroes.json`.
All five are over-recovered (35, 29, 25, 44 and 46 points against levels 27, 25, 24, 38 and
42), because both corpus files predate the 2026-08-15 patch and today's sheet math cannot
explain their numbers. Every one of their `gainPct` values collapses to `0` and `recommend`
to `false`: they were respec proposals built on points the hero cannot hold — Bellatrix@27's
advertised `+20.19%` was the largest.

NOT moved, and the proof this was the clamp and nothing else: every sheet key on every subject,
every `inferSpentPoints` value (the clamp reads `pts`, it never rewrites it), every hero whose
recovery already fit its level, and `meta.scalarCount`. The crit-damage tree-shape fix that
shipped alongside it moves nothing here either — every committed fixture carries
`crit_dmg_add: 0`, which is exactly why the shape went unmeasured for so long and why
`save-20260822-15heroes-tree-crit-dmg.json` was committed to close that gap.

---
RE-RECORDED (5) at the corrected House cycle table. The `HOUSES` endpoints were a whole-minute
reconstruction running a full minute short per house; the wiki's
`rotacao.casas[].cycle_secs_base`/`cycle_secs_max` replaced them, and neither corpus file
carries `casa.cycle_secs`, so both resolve rest through the table. **235** of the 2791 recorded
scalars moved and `meta.scalarCount` did NOT — no key was added, removed or renamed, only
values. Every one is downstream of `restSeconds`: the rest itself
(`farmContextForHero.restSeconds`, `buildStatBreakdown.derived.rest`), the duty cycle it drives
(`uptime`, and the scorer's `duty`/`fieldSeconds`/`active`/`sustained`/`objective`/`sumDuty`),
and the throughput hanging off that (`sustainedDps`, `derive.dps`, `pipelineForHero.dps`,
`resetAdvice.currentDps`/`reoptDps`/`gainPct`, `ranking[].gainPct`, `best.gainPct`).

NOT moved, and the proof this was a House-cycle change and nothing else: every sheet key on
every subject (`applySkillTree`, `composeSheetFromBirth`, `sheetsFromBirth`, `peelSheetStages`,
`peelSheetSources`), every `inferSpentPoints` value, and `avgHitBase` — rest seconds enter
after the damage math, never inside it. The permitted-delta `formulaDmg` entries were again held at
their PRE-deletion values through this re-record, so `PERMITTED_DELTAS` stays a live exception.

---
RE-RECORDED (4) at the additive drain-reduction fix: a hero's own drain reduction (Bateria
Extra) and the team's (Fôlego de Mineiro) used to be combined multiplicatively; measurement
showed they add instead, each capped at 20%, floored at a combined 60%. Moved: only the
`scorer.*` block on both corpus files (`objective`, `sumDuty`, and every hero's `duty` /
`fieldSeconds` / `sustained`) — the team-plan scorer is the one recorded subject that scores a
roster where a hero's own drain ability and a roster-wide Fôlego total can both be nonzero at
once. NOT moved: every per-hero `heroes.*` entry (`applySkillTree`, `composeSheetFromBirth`,
`sheetsFromBirth`, `peelSheetStages`, `peelSheetSources`, `inferSpentPoints`, `derive.*`), each
recorded with only one drain term active at a time, where additive and multiplicative combine
to the same number.

RE-RECORDED (3) at the 2026-08-18 patch (issue #132), which reverted crit chance and cooldown
from the flat addends the 2026-08-15 patch introduced back to percent-of-base, three days
later. **473** of the ~2800+ recorded scalars moved — every `critChance`/`cdr` field on every
subject (`applySkillTree`, `composeSheetFromBirth`, `sheetsFromBirth`, `peelSheetStages`,
`peelSheetSources`, `inferSpentPoints`, `derive.*`) and the `computeCombatMults` key rename
(`teamCritChanceFlat` → `teamCritPctOfBase`, mirroring RE-RECORDED (2)'s own rename in
reverse). `meta.scalarCount` moved too (2830 → 2832) — the walk itself is unchanged, the
corpus fixtures are unchanged, only the crit/CDR shape is. NOT moved: every non-`critChance`/
`cdr` sheet key, every `inferSpentPoints` value on the other seven keys, and everything crit-
DAMAGE (unaffected by either patch).

---
RE-RECORDED (2) at the 2026-08-15 patch, when crit chance and cooldown became flat addends
(`POINT_GAIN.critChanceFlat` / `.cdrFlat`) exactly as crit damage had at the 2026-08-13 one.
**461** of the ~2500+ recorded scalars moved, and every one is downstream of those two stats
or is the rename that carried them:

- `delta.critChance` / `delta.cdr`, `effectiveDelta.*`, `pipelineForHero.pointDelta.*` —
  13 heroes × 6, the per-point rates themselves (were `0.02 × roll` and `0.1 × roll`, now the
  flat `0.024394` and `0.03513`).
- `ranking.gainPct` (48) — the crit-chance and CDR rows of every hero's ranking.
- `effective.critChance` (18) and the `critChance` ledger totals/steps (17 + 27) — the sheet
  value itself, now `birth + Σ` rather than `birth × (1 + Σ)`.
- `critFactor` → `activeDps` → `sustainedDps` → `derive.dps` / `pipelineForHero.dps` /
  `resetAdvice.*` (9 each) — the whole damage chain hanging off crit chance.
- `computeCombatMults.teamCritPctOfBase` → `teamCritChanceFlat` (13 + 13) — a key RENAME, not
  a value change; the old key disappears and the new one appears on the same 13 heroes.

A second, smaller pass followed once the crit-chance LEDGER became flat too: 20 further
entries, all inside `critChance.steps` — 7 `amount`, 6 `running`, 3 `source` (the gear step is
a plain add now, so the tree step that used to carry `pctOfBase` provenance no longer does),
and the `meta.scalarCount` that counts them.

NOT moved, and the proof this was a crit-chance/CDR change and nothing else: every
`inferSpentPoints.*` value on all 13 heroes (the recovered point vectors are unchanged on the
pre-patch corpus this file records over), and every sheet key other than `critChance`/`cdr`.

---
RE-RECORDED (1) at the flat-crit-damage fix (`POINT_GAIN.critDmgFlat`). Exactly 85 of the
~2500+ recorded scalars moved, and every one of them was downstream of crit damage:

- `derive.delta.critDmg` / `derive.effectiveDelta.critDmg` / `pipelineForHero.pointDelta.critDmg`
  — 13 heroes x 3, the per-point rate itself (was `0.08 x roll`, now a flat `5`).
- `pipelineForHero.ranking.2.gainPct` — 13 heroes, the crit-damage row of the ranking.
- Bellatrix (id 20402) alone on everything else: she is the only corpus hero holding
  crit-damage points, so only her SHEET moved, and with it `applySkillTree.critDmg`,
  `composeSheetFromBirth.critDmg`, `adjusted`/`effective.critDmg`, her `critDmg` ledger
  totals, `critFactor`, `criticalHit`, `activeDps`/`sustainedDps`, `derive`/`pipelineForHero`
  dps, `resetAdvice` and her scorer entry.

NOT moved, and the proof this was a crit-damage change and nothing else: every
`inferSpentPoints.*` value on all 13 heroes (the recovered point vectors are unchanged), and
every non-`critDmg` sheet key on every hero and every subject. The permitted-delta `formulaDmg`
entries below were deliberately held at their PRE-deletion values through the re-record, so
`PERMITTED_DELTAS` stays a live exception rather than becoming a silently-satisfied no-op.

