---
"@bombfarm/domain": patch
---

Fix the roster gear optimizer proposing pointless swaps of items that are identical down to their rolled stats: the plan now keeps interchangeable gear on the hero already wearing it, so the move list is strictly shorter and the recommended DPS is unchanged. Where the choice is still open it equips the already-forged copy and leaves the one that would need forging in the pool, which usually shortens the forge list too — though a hero already wearing the less-forged copy keeps it, so that list can occasionally be one entry longer.
