# `farm-rate` fixture provenance

Captures whose only consumer is the farm-rate throughput model. Deliberately NOT under
`sheet-math/`: that directory is a cross-package corpus with a byte-identity contract against
`apps/web/src/tests/fixtures/sheet-math/` (`tools/fixture-corpus-parity.test.mjs`, MFR-06) and an
orphan sweep requiring a live reader in BOTH packages. This capture has exactly one reader, in
`@bombfarm/domain`, so parking it there would have forced a contrived web-side copy and a
contrived web-side test to keep those guards honest. Same scrub rules apply either way —
`fixtures-scrubbed.test.ts` walks the whole `fixtures/` tree, not a named list.

## `save-20260815-486-7heroes.json`

| Field | Value |
| --- | --- |
| Source capture | live save export, captured externally from the game client |
| Capture date | 2026-08-15 |
| Account | 486, `phase: 26`, `max_phase: 52` — 7 heroes, all `battle_allowed: true`: Bellatrix L49, Jon L48, Hale L22, Brenna L20, Gwen L13, Kael L4, Thane L4 |
| Read by | `packages/domain/tests/farm-rate-486-anchor.test.ts` |
| Scrub | `account.account_id`, `account.player_name` removed; re-serialized as 2-space JSON, matching the `sheet-math/` captures' formatting — nothing else changed |
| SHA-256 (unscrubbed source) | `c8972b2516207ab4eb77e429cfcec78496d64315ffbcd29c97754f8a454454a9` |
| SHA-256 (committed file) | `065998a26498408f5d12b068d3358d06505699256ae4ef882506fc195b24763f` |
| May prove | a roster that genuinely OVERCOMMITS its House — 7 heroes demanding 5.31 recovery slots against `casa.slots: 3`; `casa.cycle_secs` (1168.42s) diverging from the `HOUSES` table (1077s at Casa I level 11); `skills.field_slots` (6) diverging from BOTH `casa.slots` (3) and `skills.totals.vagas_campo` (5) — the `AD-063` latent divergence, on one file, in both directions |
| May **not** prove | the gold-per-prop chain against live telemetry beyond the flat rate (no `veia_ouro` or `fortuna` on any hero); before/after point deltas; a gear-swap or ability-toggle pair; the bomb-cadence term — a live fuse-bound capture is still pending, and the estimator's residual ~1.34x throughput gap at phase 26 is attributed to it and deliberately NOT closed here |

The telemetry this capture is anchored against (phase 26, same window): 371,263 gold/hr banked,
216.6 gold/prop, 1.317 heroes simultaneously on field. Tracked externally to this repo.
