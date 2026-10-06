---
"@bombfarm/domain": patch
"@bombfarm/web": patch
"@bombfarm/desktop": patch
---

Forged gear now follows the game's rebalanced upgrade values. An item's stats grow by a fixed step
per level up to +10 (×1.50), then faster: Damage, Energy, Speed, Luck and Penetration reach ×2.10
at +13, ×2.60 at +14 and ×3.50 at +15, while Crit chance and Cooldown reduction scale more gently
(×1.95 at +13, ×2.20 at +14). The slot editor and the item card show both factors once they
differ. Heroes wearing forged gear import with the right stat points again instead of reading as
overspent, so they are no longer left out of the optimizer.

A Collection's cooldown bonus now also scales the flat cooldown reduction from Short Fuse, as the
game does.

The app no longer treats the item list as changed shape after the forge patch, so every refresh stops
logging the new per-item forge fields as drift.
