# The post-patch fixture corpus (MP5 F1, `mp5-fixture-rebaseline`)

**Status (2026-08-13):** the 2026-08-13 patch removed all five keystones (Abisso/D15, Glass
Cannon/C15, Tempo Dobrado/V15, Juro Composto/O15, Sorte Composta/S15) and wiped every account.
The 41 pre-patch capture files this repo's test suites were built on — 39 `sheet-math` fixtures
plus the two old fidelity-gate captures — described an account the game can no longer produce.
This feature deletes them, deletes the 20 test files that carried the
`QUARANTINED` (catalog v4, 2026-08-11) header, re-points the ~30 surviving suites that depended
on the deleted corpus onto a new post-patch corpus, and records here what that cost.

## 1. What the corpus is now

Two captures, committed to both `packages/domain/tests/fixtures/sheet-math/` and
`apps/web/src/tests/fixtures/sheet-math/`, byte-identical across trees:

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
  proof) — no hero in either post-patch capture owns `golpe_brutal` (scanned exhaustively).
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
| Ability-slot coverage | `bellatrix-02-pts-each-1.json` (13 owned codes) | The new corpus's 8 payload heroes own 11 distinct codes; no hero owns `golpe_brutal` at all | Any account owning the missing codes |
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

**Retired as non-subjects of the level-budget invariant** (still committed, still read by the
structural suites — see each file's own README row for what it may/may not prove):
`save-20260816-5heroes-gear-cdr-crit.json`, `save-20260816-9heroes-redistrib.json`,
`save-20260816-respec-cdr-crit.json` (already excluded, pre-redistribution) and
`save-20260817-11heroes.json`. All four were captured inside the three-day flat-regime window (or
before it), so none of them solve under today's percent-of-base model — the same "no single model
reproduces both this file and the current game" reasoning §5 and §6 already apply to the
pre-2026-08-15 captures.

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
