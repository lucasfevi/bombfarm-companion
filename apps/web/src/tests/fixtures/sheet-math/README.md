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
