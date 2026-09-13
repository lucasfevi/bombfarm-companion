---
"@bombfarm/domain": minor
"@bombfarm/web": patch
"@bombfarm/desktop": patch
---

Remove the last traces of the skill-tree keystones the 2026-08-13 game patch deleted.

**The mechanics went a month ago; their vocabulary stayed.** The crit-damage multiplier the Glass
Cannon keystone used to feed survived as a hard-coded `1` threaded through `CombatMults`,
`DeriveInput`, the advisor pipeline, team-plan scoring and the stat-breakdown types — every
caller multiplied by one. That field is gone from every signature; no figure moves.

**The web planner no longer wipes a stored account for carrying the retired tree fields.** The
boot-time drop that cleared every `bf-hp-*` key on sight of `glassCannon` / `tempoDobrado` /
`abisso` / `abissoBase` / `critDmgMult` is removed; those fields are still discarded on load by
the fixed-field tree rebuild, as they have been since the patch, so a record that carries them
loads with them ignored rather than being thrown away. Nothing is migrated.

**The desktop's stored-section drop keeps the same verdicts without naming the tokens.** A
`skills` row carrying a retired `totals` key was already an added key under the schema
fingerprint; the separate retired-key list that re-found the same evidence is deleted.

The two guards that existed only to assert the keystones were absent — and the pinned per-file,
per-line maps every neighbouring edit had to re-pin — are deleted with them, along with two
orphaned fixture copies nothing read.
