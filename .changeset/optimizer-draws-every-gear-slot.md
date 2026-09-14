---
"@bombfarm/web": patch
"@bombfarm/desktop": patch
---

Draw every gear slot in the Optimizer's proposed items, empty ones included.

The per-hero "Proposed items" grid only drew a card for an item that ended on the hero, so a slot
the plan had nothing for — no piece owned that fits, or one the field-crowding term leaves bare —
simply went missing: seven cards where the game has eight slots, with nothing to say the eighth
was considered. The grid now lays out all eight in catalog order, and a slot with no item shows
the slot's name over "No item proposed", so a short grid stops reading as an item the page lost.
The sentence that used to stand in for a hero with no proposed items goes with it: eight named
empty cards say the same thing in the same place as everyone else's.
