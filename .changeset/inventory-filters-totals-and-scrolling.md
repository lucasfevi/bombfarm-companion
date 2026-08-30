---
"@bombfarm/game-art": minor
"@bombfarm/domain": minor
"@bombfarm/web": minor
"@bombfarm/desktop": minor
---

Give the list layout the cards' own filters, and head the inventory with what it is worth.

The toolbar moved out of the card layout into a component both layouts render, so the list offers
the same search, kind, rarity, hero and set narrowing instead of a search box alone. Only the sort
pair is hidden there: that layout sorts through its own column headers, and two controls for one
order is one too many.

A new `Priced` narrowing shows just the items the market is quoting right now. It is the first
filter term that is not a property of the item — it depends on a snapshot the domain cannot see —
so `filterInventoryView` takes the predicate from the caller, and with no predicate nothing is
priced, which is the truthful answer when there is no snapshot to ask.

The header states the market value of everything owned, over the count it could reach: `20 of 171
tradable items priced`. Untradable items stay out of that denominator, since the game forbids
selling them and counting them would make the coverage read worse than it is. The figure is taken
over the whole inventory rather than the filtered view, so narrowing to one set does not restate
it as a smaller fortune.

The items now scroll inside their own region rather than taking the window with them, so the
toolbar and the totals stay put while a long inventory moves under them.
