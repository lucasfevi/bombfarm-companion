---
"@bombfarm/domain": patch
---

Farm Respec Advisor: name the hero an item is taken from, instead of calling it Inventory.

When the plan sourced a piece off a hero scoped to Donate, the proposed-items card said
"From Inventory" — the item was in fact still worn by that hero. The move list now reports the
item's real wearer on both ends of the move, and pairs the equip with the unequip that has to
happen first, so the checklist no longer asks you to equip a piece it never told you to remove.
