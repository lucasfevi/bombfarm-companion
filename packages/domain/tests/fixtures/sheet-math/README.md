# `sheet-math` fixture provenance

The post-2026-08-13-patch corpus. Every fixture in this directory (and its byte-identical copy at
`apps/web/src/tests/fixtures/sheet-math/`) satisfies the positive discriminator: it carries at
least one of `skills.refunds`, `skills.totals.vagas_campo`, `skills.totals.bag_tabs_bonus`, and
none of `keystones`, `abisso_base`, `crit_dmg_mult` — enforced by `fixture-corpus.test.ts`.

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
| SHA-256 (committed file) | `72e806c17877812b626ddb0dfb09c7b8c3b99d32a5a2553874cabf07ca867589` (identical to `packages/domain/tests/fixtures/api/assembled-payload-before.json`, checked by `tools/fixture-corpus-parity.test.mjs`) |
| May prove | whole-roster round trip with **zero** inference issues on all 8 heroes; battle-allowed vs. not-battle-allowed hero handling; the larger inventory (27 catalogued items) for team-plan search and import-sync assertions |
| May **not** prove | save-file shape (no `export_version`/`generated_at`); the duplicate-hero-name a11y case (all 8 names are distinct); item-upgrade variety for forge assertions (every upgrade is `0`); high-phase mitigation; before/after point deltas, ability-toggle or gear-swap pairs (same single-snapshot limits as the export) |

## `save-20260816-8heroes.json`

| Field | Value |
| --- | --- |
| Source capture | live save export, captured externally from the game client |
| Capture date | 2026-08-16 |
| Account | 486, `phase: 26`, `max_phase: 52` — 8 heroes: Bellatrix L53 (8/8 geared), Jon L54 (8/8), Gwen L32 (7/8), Minato L42 (8/8), Lorne L27 (6/8), Orin L17 (4/8), Korin L13 (3/8), Torin L4 (**naked, no items at all**) |
| Capture log entry | *Post-2026-08-15-patch re-baseline*, 2026-08-16 row (tracked externally to this repo) |
| Scrub | `account.account_id`, `account.player_name` removed via `scrubPersonalFields` (`packages/domain/tests/helpers/fidelity-pair.ts`) — nothing else changed |
| SHA-256 (unscrubbed source) | `3d54a17a73a3ef20a5fe7f2512d2bcaf9ad84ba82ce07a9f73ec0a48d227bbe1` |
| SHA-256 (committed file) | `40735f96b52ed1b88d5aff340b8e1ab945f039a7a1be04ce714298a7d81c1698` |
| May prove | the post-2026-08-15-patch sheet math end to end — **whole-roster round trip with zero inference issues on all 8 heroes, every point budget landing exactly on `level`**; the FLAT crit-chance shape isolated three ways (Torin: tree term alone; Gwen/Minato/Lorne/Orin/Korin: tree + gear; Bellatrix/Jon: tree + gear + `olho_clinico` 20); the flat cooldown shape (Minato's `gold_elmo`, the corpus's only cooldown roll); post-patch item catalog shapes (nv10 and nv20, `ember`/`gold`); a hero above the old L49 XP-curve knee (Jon L54); `skills.levels.H05` at 10, i.e. the game's own migration of the retired bag-tab node onto the new Sorte node |
| May **not** prove | crit DAMAGE post-patch (`crit_dmg_add` is 0 and no hero owns `golpe_brutal`; every hero's `stats.crit_dmg` equals `birth_stats.crit_dmg`); star scaling of any flat term (every hero is ★0); nv100+ item scaling (only nv10/nv20 gear exists); heroes above L100; high-phase mitigation (`max_phase` 52) |

## `save-20260816-respec-cdr-crit.json`

| Field | Value |
| --- | --- |
| Source capture | live save export, captured externally from the game client — the same account ~10 minutes after `save-20260816-8heroes.json` |
| Capture date | 2026-08-16 |
| Account | 486, `phase: 26`, `max_phase: 52` — the same 8 heroes, with **Torin L4 respecced from 3 attack + 1 energy into 2 cooldown + 2 crit chance** |
| Capture log entry | *Post-2026-08-15-patch re-baseline*, 2026-08-16 row (tracked externally to this repo) |
| Scrub | `account.account_id`, `account.player_name` removed via `scrubPersonalFields` — nothing else changed |
| SHA-256 (unscrubbed source) | `21e86d6bbf9d249edb264b23228460d2bf3943bf3cd9ebd31c4c5c8471ad2dbc` |
| SHA-256 (committed file) | `2c7fec50c939dd8569e4e6bdb3ce002c59edb8d441accb445b766417a19359ce` |
| May prove | **the before/after point-delta pair** this corpus recorded as structurally unreproducible after the 2026-08-13 wipe (see `docs/fixture-corpus.md` §5) — deliberately produced by respeccing one hero. Torin owns no items and no crit ability, so his entire sheet move between the two files is the stat-point term alone: `crit_chance` +0.00048788 = 2 × `ponto_inc` (residual 3.0e-18) and `cooldown_reduction` +0.0007026 = 2 × `ponto_inc` (residual −1.1e-19), with NO base-roll and NO level scaling. Also pins that attack and energy points did **not** change shape (they invert to exactly 3 and 1 before, 0 and 0 after) |
| May **not** prove | anything the sibling export cannot — it is the same account minutes later. In particular the respec touched one ★0 hero, so star scaling of the flat point term stays unobserved |

## `save-20260816-9heroes-redistrib.json`

| Field | Value |
| --- | --- |
| Source capture | live save export, captured externally from the game client |
| Capture date | 2026-08-16 (after the same-day item-redistribution patch) |
| Account | 486, `phase: 28`, `max_phase: 52` — 9 heroes: Bellatrix L56 (8/8), Jon L57 (8/8), Minato L46 (8/8), Doran L42 (8/8), Zane L7, Aldric L5, Torin L4, Rowan L4, Cora L3 (the last five naked) |
| Capture log entry | *Item-redistribution patch re-baseline*, 2026-08-16 row (tracked externally to this repo) |
| Scrub | `account.account_id`, `account.player_name` removed via `scrubPersonalFields` — nothing else changed |
| SHA-256 (unscrubbed source) | `651d8f8ee7fb881f55a8b5432b780f083031aead3eab0ba45dbdd53f599c3f45` |
| SHA-256 (committed file) | `48485b0fa5948f10fb7bb5d68dbfc1c56a01ac5322e57a5dd2aec342d62b9506` |
| May prove | **the only capture whose gear matches the shipped catalog** — the same-day redistribution changed which stats 239 of 240 defs roll, so every earlier capture's items are stale. Whole-roster round trip with zero inference issues on all 9 heroes, every point budget landing exactly on `level`. **The first post-patch witness for crit DAMAGE**: Zane holds `golpe_brutal` 7 and Doran 20, and both sheets sit exactly `rank × 0.04` above their roll with residual **exactly 0** — so the flat crit-damage model survives both August patches, measured rather than assumed. **The first witness for `pressagio_mortal`** (Rowan r4, Cora r3): their entire sheet delta is the tree term alone, confirming the team-crit ability contributes nothing to the inventory sheet. Also the new per-slot roll priorities in live data (chest → penetração first, pants → recarga first) |
| May **not** prove | star scaling of any flat term (every hero is ★0); nv30+ item scaling (only nv10/nv20 gear exists); heroes above L100; high-phase mitigation (`max_phase` 52); the combat-side magnitude of `pressagio_mortal` (it is off-sheet by construction, so a sheet capture can never measure it) |

## `save-20260816-5heroes-gear-cdr-crit.json`

| Field | Value |
| --- | --- |
| Source capture | live save export, captured externally from the game client — the same account ~43 minutes after `save-20260816-9heroes-redistrib.json` |
| Capture date | 2026-08-16 (after the same-day item-redistribution patch) |
| Account | 486, `phase: 52`, `max_phase: 52` — 5 heroes: Bellatrix L56 (8/8), Jon L57 (8/8), Minato L46 (8/8), Doran L42 (8/8), Bram L11 (**naked, no items at all**) |
| Capture log entry | *Flat crit/CDR item challenge*, 2026-08-16 row (tracked externally to this repo) |
| Scrub | `account.account_id`, `account.player_name` removed via `scrubPersonalFields` — nothing else changed |
| SHA-256 (unscrubbed source) | `01b0350677cb67094e65c4ea8380ee22dcc569097c7216f6700eb08e38ac4205` |
| SHA-256 (committed file) | `ca519d732028dc2c915cd181ce097f3d99a4faeff83686787abf20be607bcd51` |
| May prove | **the ITEM half of the flat crit-chance/CDR shape, which no earlier capture isolates.** Every hero here wears gear rolling `crit` and/or `cooldown`, and every hero's `cooldown_reduction` delta equals the plain SUM of its items' `effective` cooldown values to ≤3e-18 — with no base-roll factor anywhere. The knockout is the two matched pairs: Bellatrix and Jon carry identical gear + `olho_clinico` 20 across birth rolls 74% apart (0.0508 vs 0.0883) and move by the **identical** 0.014785640125; Minato and Doran carry two crit rings each across rolls 55% apart and move by the identical 0.007485985725. Percent-of-base predicts deltas in the ratio of the bases and is off by ~100% of the delta on all five. Bram adds the corpus's cleanest tree witness — zero items, no crit ability, so his whole crit delta *is* `crit_chance_add`. Also a whole-roster round trip with zero inference issues, every point budget landing exactly on `level` |
| May **not** prove | the per-POINT rates — all five heroes spend zero crit-chance and zero CDR points, so `POINT_GAIN.critChanceFlat` / `.cdrFlat` still rest on `save-20260816-respec-cdr-crit.json` alone. Also: star scaling of any flat term (every hero is ★0); nv30+ item scaling (only nv10/nv20 gear); heroes above L100; crit DAMAGE (`crit_dmg_add` is 0 and only Doran owns `golpe_brutal`) |

**NON-SUBJECT as of the 2026-08-18 patch** (issue #132) — same reasoning as
`save-20260816-9heroes-redistrib.json` above: flat-regime crit chance/CDR, excluded from
`points-within-level-budget.test.ts`'s level-budget invariant, still committed for structural
coverage.

## `save-20260817-11heroes.json`

| Field | Value |
| --- | --- |
| Source capture | live save export, captured externally from the game client |
| Capture date | 2026-08-17 |
| Account | 486, `phase: 51`, `max_phase: 62` — the corpus's largest roster and highest phase to date: 11 heroes: Bellatrix L59 (8/8), Jon L60 (8/8), Minato L51 (8/8), Doran L45 (8/8), Bram L23 (**7/8 — missing only the pants slot**), Lorne L10, Gwen L2, Aric L3, Yara L2, Devin L2, Lyra L2 (the last six naked) |
| Capture log entry | *Highest-phase, largest-roster re-baseline*, 2026-08-17 row (tracked externally to this repo) |
| Scrub | `account.account_id`, `account.player_name` removed via `scrubPersonalFields` (`packages/domain/tests/helpers/fidelity-pair.ts`) — nothing else changed |
| SHA-256 (unscrubbed source) | `bbbd1d3025184f2f78146844ac7040a6f769485d696153438c9a0984363eec20` |
| SHA-256 (committed file) | `882168841a16fefc66dceb2fdd68bfb9f03e0739f9cd150d329fb7ac93ada6bb` |
| May prove | whole-roster round trip with zero inference issues on all 11 heroes, every point budget landing exactly on `level` (verified directly against `inferSpentPoints`/`composeSheetFromBirth`, not assumed); the largest simultaneous naked cluster in the corpus (six heroes, L2–L10, zero items each) for roster-list and bulk-zero-equipped assertions; a second, more targeted partial-gear witness alongside `save-20260813-5heroes.json`'s Jon 4/8 — Bram 7/8 is missing exactly one slot (pants); the item catalog matches the current post-redistribution shapes already established in `save-20260816-9heroes-redistrib.json` (same `def_id` → `stats` mapping, checked directly), so this file is a valid subject for any corpus-wide sweep over that catalog; item-upgrade variety (`{0, 8}`) and gear-rarity variety (`{0, 1, 2}`) for forge assertions; Doran's `golpe_brutal` 20 reproduces the flat crit-damage pin (`+0.8` exactly) already measured elsewhere, corroborating rather than newly establishing it |
| May **not** prove | star scaling of any flat term (every hero is ★0); before/after point deltas (`stat_points_available` is `0` on every hero — the same limitation `save-20260813-5heroes.json`'s entry records); an ability-toggle pair or a gear-swap pair (single snapshot); the per-POINT crit-chance/CDR rates (no hero here spends a point on either — that still rests on `save-20260816-respec-cdr-crit.json` alone); a NEW item-catalog witness (the gear shapes are identical to the already-committed post-redistribution catalog, not a fresh measurement); the duplicate-hero-name a11y case (all 11 names are distinct); heroes above L100; high-phase mitigation beyond this capture's own ceiling (`max_phase` caps at 62) |

**NON-SUBJECT as of the 2026-08-18 patch** (issue #132): this file's crit chance and cooldown
are flat addends (`save-20260816-9heroes-redistrib.json`'s captured regime), and the 2026-08-18
patch reverted both to percent-of-base with a rescaled item catalog. No single model reproduces
this file and the current game, so it is excluded from `points-within-level-budget.test.ts`'s
level-budget invariant — same treatment as the pre-2026-08-15 captures above. Still committed and
still read by the structural suites for hero/gear/inventory shapes, which the crit/CDR regime
does not touch.

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
