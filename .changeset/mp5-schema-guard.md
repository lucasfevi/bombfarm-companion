---
"@bombfarm/domain": minor
"@bombfarm/game-api": minor
"@bombfarm/contracts": minor
"@bombfarm/web": minor
"@bombfarm/desktop": patch
---

**The drift guard can now see the change it was built to catch.** The 2026-08-13 game patch
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
