---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Fix the gear plan solver proposing an item above a hero's level: the swap move family (trading two heroes' same-slot items) didn't recheck level eligibility on the item's new owner, only assign-from-pool moves did. A high-level hero's item could get swapped onto a lower-level hero even though it's above what that hero can equip. Also fixed hero level display on the gear plan results page to consistently read "Lv 82" instead of "L82"/"Lv82".
