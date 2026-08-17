---
"@bombfarm/contracts": patch
"@bombfarm/game-data": patch
---

Removes `InventoryItem.iconUrl` and the parser that built it.

The inventory parser composed a live wiki asset URL from the item's *instance* level and handed it
back on every parsed item. Nothing rendered that field — item art comes from the bundled assets via
`itemIconSrc`, which keys off the set's native level — so the URL was both unused and wrong. Item
art must never be sourced from the wire, so the builder and the contract field are gone rather than
corrected.

No consumer migration: the field had no readers.
