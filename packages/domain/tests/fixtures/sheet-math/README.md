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
| Source capture | `bombfarm-research/data/save-export-20260813/SaveFile_BombFarm.json` |
| Capture date | 2026-08-13 |
| Account | 486 (post-wipe), `phase: 24`, `max_phase: 42` — 5 heroes: Jon L38 (4/8 geared), Bellatrix L42 (8/8 geared), Perrin L4 (naked), Perrin L3 (naked), Lyra L2 (naked) |
| `CAPTURE_LOG.md` row | *Keystone removal + account wipe* (`bombfarm-research/docs/CAPTURE_LOG.md`, 2026-08-13 row) |
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
| `CAPTURE_LOG.md` row | none — this fixture predates MP5 and has no dedicated `bombfarm-research/docs/CAPTURE_LOG.md` entry; it was already committed and already scrubbed of `account_id`/`player_name` (`D19`) before this feature. Recorded as a limitation, not papered over |
| Scrub | none applied by this feature — the source file was already scrubbed when it was committed |
| SHA-256 (unscrubbed source) | not applicable — no unscrubbed predecessor exists in either repo; the earliest committed form is already scrubbed |
| SHA-256 (committed file) | `72e806c17877812b626ddb0dfb09c7b8c3b99d32a5a2553874cabf07ca867589` (identical to `packages/domain/tests/fixtures/api/assembled-payload-before.json`, checked by `tools/fixture-corpus-parity.test.mjs`) |
| May prove | whole-roster round trip with **zero** inference issues on all 8 heroes; battle-allowed vs. not-battle-allowed hero handling; the larger inventory (27 catalogued items) for team-plan search and import-sync assertions |
| May **not** prove | save-file shape (no `export_version`/`generated_at`); the duplicate-hero-name a11y case (all 8 names are distinct); item-upgrade variety for forge assertions (every upgrade is `0`); high-phase mitigation; before/after point deltas, ability-toggle or gear-swap pairs (same single-snapshot limits as the export) |
