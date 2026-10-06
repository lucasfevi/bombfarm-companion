---
"@bombfarm/domain": patch
"@bombfarm/web": patch
"@bombfarm/desktop": patch
---

Forged gear now uses the game's new upgrade values: an item's stats grow by a fixed step per level
up to +10 (×1.50), then faster (×1.95 at +13, ×2.20 at +14, ×2.50 at +15). Heroes wearing forged
gear import with the right stat points again instead of reading as overspent, so they are no
longer left out of the optimizer.

The app no longer treats the item list as changed shape after the forge patch, so every refresh stops
logging the new per-item forge fields as drift.
