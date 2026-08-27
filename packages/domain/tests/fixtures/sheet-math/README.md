# `sheet-math` fixture provenance

The post-2026-08-13-patch corpus. This directory is the sole committed copy — `apps/web` reads it
directly by relative path rather than holding a copy of its own, and
`tools/fixture-corpus-parity.test.mjs` fails if one is ever committed there again.

Every fixture here satisfies the positive discriminator: it carries at least one of
`skills.refunds`, `skills.totals.vagas_campo`, `skills.totals.bag_tabs_bonus`, and none of
`keystones`, `abisso_base`, `crit_dmg_mult` — enforced by `fixture-corpus.test.ts`.

For what this deletion cost, the unreproducible fixture families it replaced, and the round-trip
invariant's one accepted residual gap, see
[`docs/fixture-corpus.md`](../../../../../docs/fixture-corpus.md) (the link does not resolve until
that file lands later in this feature — expected, not a defect of this manifest).

## `save-20260813-5heroes.json`

| Field | Value |
| --- | --- |
| Source capture | live save export, captured externally from the game client |
| Capture date | 2026-08-13 |
| Account | 486 (post-wipe), `phase: 24`, `max_phase: 42` — 5 heroes: Jon L38 (4/8 geared), Bellatrix L42 (8/8 geared), Perrin L4 (naked), Perrin L3 (naked), Lyra L2 (naked) |
| Capture log entry | *Keystone removal + account wipe*, 2026-08-13 row (tracked externally to this repo) |
| Scrub | `account.account_id`, `account.player_name` removed via `scrubPersonalFields` (`packages/domain/tests/helpers/fidelity-pair.ts`) — nothing else changed |
| SHA-256 (unscrubbed source) | `fb87b0051bf6842af1a691493d9a52e7baa6ca6f582d1916778c147b4b017b04` |
| SHA-256 (committed file) | `f6fe17e5d246f9b873b95fc0a51ead10a596cf061272b3b53ab5c3f344393694` |
| May prove | save-file import shape (`export_version`, `generated_at`); the fidelity pair (`fidelity-gate/export-capture.json` is a byte copy of this file); the duplicate-hero-name a11y case (two Perrins); item-upgrade variety (`{0, 8}`) for forge assertions; naked-loadout identity; a real partially-geared observation (Jon, 4/8) and a real fully-geared one (Bellatrix, 8/8); full `birth_stats`/`stat_ranges`/`skills.levels`/`casa`/`items` shapes |
| May **not** prove | high-phase mitigation (`max_phase` caps at 42); before/after point deltas (`stat_points_available` is `0` on every hero); an ability-toggle pair; a gear-swap pair; a whole-roster zero-inference-issue round trip (Bellatrix L42 returns one `nonIntegerPoints` issue on `critDmg` — a real, pinned inference ambiguity, not a defect of this file) |

## `payload-20260812-8heroes.json`

| Field | Value |
| --- | --- |
| Source capture | `packages/domain/tests/fixtures/api/assembled-payload-before.json` (already committed to this repo; byte copy, unmodified) |
| Capture date | 2026-08-12 |
| Account | API-assembled `AccountPayload`, `phase: 21`, `max_phase: 33` — 8 heroes (5 battle-allowed: Nyx L25 8/8, Bellatrix L27 8/8, Cora L22 4/8, Wren L24 3/8, Devin L5 naked; 3 not battle-allowed: Lyra L3, Mira L3, Bryn L3, all naked) |
| Capture log entry | none — this fixture predates MP5 and has no dedicated capture-log entry; it was already committed and already scrubbed of `account_id`/`player_name` (`D19`) before this feature. Recorded as a limitation, not papered over |
| Scrub | none applied by this feature — the source file was already scrubbed when it was committed |
| SHA-256 (unscrubbed source) | not applicable — no unscrubbed predecessor exists in either repo; the earliest committed form is already scrubbed |
| SHA-256 (committed file) | `d9bfac297f188a10ff6885d00844a9f99c21e2a1171f667ea9d8ee4783003435` (identical to `packages/domain/tests/fixtures/api/assembled-payload-before.json`, checked by `tools/fixture-corpus-parity.test.mjs`) |
| May prove | whole-roster round trip with **zero** inference issues on all 8 heroes; battle-allowed vs. not-battle-allowed hero handling; the larger inventory (27 catalogued items) for team-plan search and import-sync assertions |
| May **not** prove | save-file shape (no `export_version`/`generated_at`); the duplicate-hero-name a11y case (all 8 names are distinct); item-upgrade variety for forge assertions (every upgrade is `0`); high-phase mitigation; before/after point deltas, ability-toggle or gear-swap pairs (same single-snapshot limits as the export) |

## RETIRED — the five 2026-08-16 / 2026-08-17 captures

Removed from the corpus on 2026-08-25. Their provenance is kept here because the corpus's rule is
that a deletion is *recorded*, not silently taken (`docs/fixture-corpus.md` §5).

| file | account state | SHA-256 (committed form) |
| --- | --- | --- |
| `save-20260816-8heroes.json` | 486, `phase: 26` — 8 heroes, Torin L4 naked | `40735f96b52ed1b88d5aff340b8e1ab945f039a7a1be04ce714298a7d81c1698` |
| `save-20260816-respec-cdr-crit.json` | the same 8 heroes ~10 min later, Torin respecced 3 attack + 1 energy → 2 cooldown + 2 crit chance | `2c7fec50c939dd8569e4e6bdb3ce002c59edb8d441accb445b766417a19359ce` |
| `save-20260816-9heroes-redistrib.json` | 486, `phase: 28` — 9 heroes, after the same-day item-redistribution patch | `48485b0fa5948f10fb7bb5d68dbfc1c56a01ac5322e57a5dd2aec342d62b9506` |
| `save-20260816-5heroes-gear-cdr-crit.json` | 486, `phase: 52` — 5 heroes, every geared one rolling `crit` and/or `cooldown` | `ca519d732028dc2c915cd181ce097f3d99a4faeff83686787abf20be607bcd51` |
| `save-20260817-11heroes.json` | 486, `phase: 51`, `max_phase: 62` — 11 heroes, six of them naked | `882168841a16fefc66dceb2fdd68bfb9f03e0739f9cd150d329fb7ac93ada6bb` |

**Why they went, and why now.** All five were captured inside — or immediately before — the
three-day window in which crit chance and cooldown were flat addends, which the 2026-08-18 patch
reverted while also rescaling the item catalog's `crit` / `cooldown` bases. No single model
reproduces one of these files and the current game, so every sheet-math suite had already excluded
them by name: `point-roundtrip.test.ts` dropped them as subjects, and
`points-within-level-budget.test.ts` listed all five in `NON_CURRENT_REGIME_CAPTURES`. What was
left was structural coverage — hero shapes, gear shapes, inventory, roster size — and the four
current-regime captures (`save-20260818-12heroes`, `save-20260819-respec-crit-cdr`,
`save-20260822-15heroes-tree-crit-dmg`, `save-20260823-13heroes-crit-points`) carry all of it, with
larger rosters.

**What they proved, so a future capture request knows what to ask for.** These are the measurements
that no longer have a committed witness. Each was established rather than assumed, and none of them
describes the current regime, so nothing in the shipped model rests on them today:

- the **before/after point-delta pair** — the respec pair was deliberately produced to recover the
  structure lost to the 2026-08-13 wipe: one ★0 hero with no items and no crit ability, moving
  `crit_chance` and `cooldown_reduction` by exactly `2 × ponto_inc` each with no base-roll and no
  level scaling. The flat per-point rates it pinned are superseded;
- the **ITEM half of the flat crit/CDR shape**, via two matched pairs carrying identical gear
  across birth rolls 74% and 55% apart and moving by identical deltas — the argument that settles
  flat-versus-percent without fitting a coefficient. Worth reconstructing on any future rescale,
  from a fresh capture rather than from these;
- the **post-redistribution item catalog** as live data (chest → penetração first, pants → recarga
  first), and the first witnesses for `pressagio_mortal` being off-sheet and for `golpe_brutal`
  landing at a flat `rank × 0.04`. The crit-damage pin is independently reproduced by
  `save-20260823-13heroes-crit-points.json` and by the constructed Ivo case in
  `points-within-level-budget.test.ts`, so it did not leave with them.

**A note on "over-spent heroes", because the wording matters.** Running today's `inferSpentPoints`
over these files recovers more points than several heroes' levels allow — up to 109 points on a
level-42 hero. **A hero can never spend more points than its level, and none of these did.** The
captures record legal accounts: every affected hero carries `stat_points_available: 0`, which is
the game's own statement that the hero has spent exactly its level and no more. Minato is level 42
with nothing unspent, so the game says 42; the inversion says 109.

What over-spends is therefore the INVERSION, not the account, and that is a defect in the sheet
math rather than in the data: today's model is being run against a capture from an older ability
regime, so contributions that came from abilities and gear get charged to spent points. The excess
lands in `critChance`, `cdr` and `penetration`, exactly the columns those patches reshaped, and
every affected hero also carries a `PointInferenceIssue` saying the sheet could not be inverted
exactly.

It is not harmless. An over-recovered vector is wrong information, and it escaped once already —
the Respec Advisor budget escape fixed in PR #183 was exactly such a vector flowing out into a
recommendation. `points-within-level-budget.test.ts` asserts, over the whole fixture tree and with
no exclusion list, that any inversion reporting no issue stays inside the ceiling.

## `save-20260818-12heroes.json`

| Field | Value |
| --- | --- |
| Source capture | live save export, captured externally from the game client |
| Capture date | 2026-08-18 |
| Account | 486, `phase: 51`, `max_phase: 62` — 12 heroes: Minato L67 (8/8 geared), Jon L69 (8/8), Bellatrix L64 (8/8), Doran L55 (8/8), WB #2 L40, WB #1 L43, Manco #1 L41 (8/8), Isolde L26, Sora L10, Joric L10, Aric L2, Eryn L2 (the last six naked) |
| Capture log entry | *Crit-chance/CDR revert re-baseline*, 2026-08-18 row (tracked externally to this repo) |
| Scrub | `account.account_id`, `account.player_name` removed — nothing else changed |
| SHA-256 (unscrubbed source) | `9abdd8166565d1440ade253b9ce055501124fdcd7016116e4f71a8e75de510aa` |
| SHA-256 (committed file) | `ebbcbea10adadf406c631ba1202f5e90c07899ddae56469079d5ee8d171cfe6a` |
| May prove | **the post-2026-08-18-patch sheet math end to end** — whole-roster round trip with zero inference issues on all 12 heroes, every point budget landing exactly on `level`. The percent-of-base crit-chance shape isolated two ways: four item-free, ability-free heroes (Sora, Joric, Aric, Eryn) whose whole sheet-minus-birth move is the tree term alone (`crit_chance_add = 0.03093301657` as a fraction, not a flat pp addend), and three `olho_clinico` rank-20 witnesses (Minato, Jon, Manco #1) who each leave a residual of exactly `0.857142857142857` (= 6/7) after tree + gear. The rescaled item catalog's `crit`/`cooldown` bases (`0.00644023` / `0.00936771`), confirmed against every equipped item's raw pre-forja `value` field with zero mismatches. Also the anchor for `farm-rate-486-anchor.test.ts`'s phase-26 row and the `farm-basis-parity` re-capture |
| May **not** prove | the per-POINT crit-chance/CDR rates or their split (see `save-20260819-respec-crit-cdr.json`); star scaling of any percent-of-base term (every hero is ★0); crit DAMAGE post-revert (`crit_dmg_add` is 0 and no hero owns `golpe_brutal`); `pressagio_mortal` (no hero owns it — see the abilities.ts comment) |

## `save-20260819-respec-crit-cdr.json`

| Field | Value |
| --- | --- |
| Source capture | live save export, captured externally from the game client — the same account ~2 hours after `save-20260818-12heroes.json` |
| Capture date | 2026-08-19 |
| Account | 486, `phase: 51`, `max_phase: 62` — the same 12 heroes, with **Sora L10 respecced from 10 attack points into 5 crit chance + 5 cooldown** |
| Capture log entry | *Crit-chance/CDR revert re-baseline*, 2026-08-19 row (tracked externally to this repo) |
| Scrub | `account.account_id`, `account.player_name` removed — nothing else changed |
| SHA-256 (unscrubbed source) | `11835d1e14610a622000f6c742cac315f819a149d410bd4e8fdebe6471444319` |
| SHA-256 (committed file) | `e8b8bc03d4615329fd66c2c40f2c3f95ba05b864623006e745f4fb9ae58c1716` |
| May prove | **the per-POINT crit-chance and CDR rates, and their split** — Sora owns no items and no crit/cooldown ability, so her entire sheet move between the two files is the stat-point term alone: her crit multiplier moves `1.0309330166 → 1.1309330166` and her cooldown multiplier `1.0000000000 → 1.1000000000` on exactly 10 moved points, both by exactly `+0.1`. Every other stat (attack, energy, speed, luck, penetration, crit damage) solves to zero points for her, so the 10 are provably all crit chance + cooldown. Combined with the external crit-chance anchor (0.02, corroborated by the wiki mirror's `ponto_inc` table), this pins the split at 5 + 5 and both rates at `0.02` each |
| May **not** prove | anything the sibling export cannot — it is the same account ~2 hours later. In particular the respec touched one ★0 hero, so star scaling of the point term stays unobserved |

## `save-20260822-15heroes-tree-crit-dmg.json`

| Field | Value |
| --- | --- |
| Source capture | live save export, captured externally from the game client |
| Capture date | 2026-08-22 |
| Account | 486, `phase: 51`, `max_phase: 122` — 15 heroes, levels 1 to 97, one (`Buff S #1`) carrying `golpe_brutal` 20/20 |
| Capture log entry | *Skill-tree crit-damage shape*, 2026-08-22 row (tracked externally to this repo) |
| Scrub | `account.account_id`, `account.player_name` removed — nothing else changed |
| SHA-256 (unscrubbed source) | `51269bc374a8c11ec7bb8e14cf329acbedcf41fc155bd6cf8ed043a0a3cb5dc9` |
| SHA-256 (committed file) | `099ffada706f8ade35d0efde493609794e84e80d81cdadcd811767a7c084742c` |
| May prove | **the skill tree's `crit_dmg_add` shape** — the first capture in the corpus with a nonzero value (`0.081730769`), which is what makes it worth committing. All 15 heroes gain the SAME `+8.1730769` crit-damage percentage points over their birth roll, across rolls spanning `45.03 … 73.13` and levels `1 … 97`: the node is a FLAT addend, not percent-of-base (which would have spread it over `3.68 … 5.98`, hero by hero). Items never roll crit damage and no hero here holds a crit-damage point, so the tree is the only term in the gap. `Buff S #1` additionally proves the tree's flat term and Golpe Brutal's flat `+80` simply stack. With the shape corrected, every hero solves to a whole-number point vector with zero inference issues, each landing exactly on `level` |
| May **not** prove | star scaling of the tree's crit-damage term (every hero is ★0), nor whether it would scale with a crit-damage point present (none is spent anywhere in the roster); the per-POINT crit-chance/CDR rates (see `save-20260819-respec-crit-cdr.json`) |

## `save-20260823-13heroes-crit-points.json`

| Field | Value |
| --- | --- |
| Source capture | live save export, captured externally from the game client |
| Capture date | 2026-08-23 |
| Account | 486, `phase: 51`, `max_phase: 137` — 13 heroes, levels 2 to 106; three carry `olho_clinico` (Minato and Jon at 20/20 with gear, Perrin at 13/20 with none) and one (`Buff S #1`) carries `golpe_brutal` 20/20 |
| Capture log entry | *Crit-chance abilities restated in points*, 2026-08-23 row (tracked externally to this repo) |
| Scrub | `account.account_id`, `account.player_name` removed — nothing else changed |
| SHA-256 (unscrubbed source) | `53e9b06e7bd5263339b986d219e97ced795d96d2dc3e576cc81b567665ef82d3` |
| SHA-256 (committed file) | `0c7bd67a30fda0f839b86c6dd38d21f0b3c41de519ca87c34e18c3a4fcee8552` |
| May prove | **the crit-chance ABILITY shape** — the first capture taken after the patch that restated Olho Clínico and Presságio Mortal in flat crit POINTS. Perrin is the discriminating hero: `olho_clinico` 13/20, no gear, no crit-chance points, so his exported `crit_chance × 100` is exactly `6.02142890221474 + 13 × 2 + 6.02142890221474 × 0.08042584275 = 32.5057073962346` — the flat addend, its exclusion from the shared pool, and the tree reading the PRE-ability roll, all pinned by one hero. Minato (gear crit `+3.7869%`) and Jon (`+15.1474%`) add the gear leg: both solve to exactly zero crit-chance points under the pool-excluded reading and to fractional negatives if the `+40` rides inside the pool. Percent-of-base fits none of the three. All 13 heroes solve to a whole-number point vector with zero inference issues, each landing exactly on `level`. Also carries the ROLL RANGES the same patch changed, in `heroes[].stat_ranges` (`dmg 150–200` / `energia 140–240` for a Raro), which is what caught `BASE_ROLLS`' attack and energy columns drifting |
| May **not** prove | star scaling of either flat sheet-ability addend (every hero is ★0); Presságio Mortal's own value (no hero on any capture owns it — its rate is the wiki's published one); the per-POINT crit-chance/CDR rates (nobody here holds a crit-chance or cooldown point — see `save-20260819-respec-crit-cdr.json`) |
