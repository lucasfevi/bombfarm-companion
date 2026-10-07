---
"@bombfarm/domain": patch
"@bombfarm/contracts": patch
"@bombfarm/game-data": patch
"@bombfarm/game-art": patch
"@bombfarm/desktop": patch
"@bombfarm/web": patch
---

Inventory, Forge and Deconstruct show your current inventory again after the game update. The game stopped sending the gold sell value when it removed selling items for gold, and the app was treating that as a damaged read and falling back to an old snapshot, so Deconstruct could offer items you no longer had. The gold value on item cards, the Value column and the Value sort are gone with it.

Items imported from Steam can be burned in Deconstruct right away, as the game now allows.
