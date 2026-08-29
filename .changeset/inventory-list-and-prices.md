---
"@bombfarm/game-art": minor
"@bombfarm/web": minor
"@bombfarm/desktop": minor
---

Show what the market is asking for each item you own, and offer the inventory as a sortable list
beside the cards.

Every item now carries its Steam Community Market price above the in-game gold value, linking to
the listing it came from. The figure is the one Steam quotes in that currency, so it matches the
page behind the link; where Steam declined to quote it, the price is converted from USD and marked
approximate rather than presented as exact. Each price says how old the quote behind it is, dated
by that quote rather than by the file that carried it.

The new list layout is a real table: sortable column headers that carry `aria-sort` and activate
through a real button, numeric columns aligned on their digits, and a per-row action named after
its own item so a screen reader hears "Refresh the market price for Coal Boots" rather than a
column of identical labels. Sorting reuses the cards' own multi-term model, so picking a second
column keeps the first as the tie-break, and it sorts within a kind rather than across — a key
never lands between two swords. Items the market has no price for sink to the bottom whichever
direction is chosen, instead of crowding out real prices on a cheapest-first sort.

The chosen layout is remembered per browser. A shell with no snapshot renders exactly as it did
before, price column and all.
