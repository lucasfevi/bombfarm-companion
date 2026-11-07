---
"@bombfarm/desktop": patch
"@bombfarm/game-api": patch
---

Accounts with thousands of chests no longer stop updating their heroes and inventory: the app now reads inventories far larger than before. If those two still can't be read, a notice at the top of the window says so and how old the data on screen is, and the app retries less often instead of downloading the same failing reply every minute.
