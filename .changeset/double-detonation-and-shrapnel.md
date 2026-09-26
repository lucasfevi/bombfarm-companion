---
"@bombfarm/domain": patch
"@bombfarm/hero": patch
"@bombfarm/game-art": patch
"@bombfarm/web": patch
"@bombfarm/desktop": patch
---

Two more changes from the 2026-09-26 game patch.

Double Detonation (Detonação Dupla) now gives +2.5% chance of a second blast per level, up from 1.5%, so a rank-20 hero sets one off on half its bombs instead of 30% of them. That hero's damage multiplier rises from ×1.15 to ×1.25 (about +8.7%) on the Farm board, active DPS and the Optimizer, and the ability's description and readout say 2.5%.

Shrapnel (Estilhaços), the game's new 21st ability, is modelled. Each level gives +2.5% chance that a rock the hero destroys shatters, hitting every rock on its four sides for half the killing hit. It hits only rocks, never the boss or the cage, and a rock felled by a shard does not shatter again. The farm estimate counts the shards as extra hits, each needing its own hits-to-kill, so they help most where half a hit can still break a rock. Active DPS figures leave it out, because it pays per rock destroyed rather than per bomb. Heroes with Shrapnel used to import with an "Unknown ability" warning and got no credit for it. They now import cleanly and show the ability with its icon.
