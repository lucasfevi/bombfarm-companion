---
"@bombfarm/domain": patch
---

Team Plan starts one of its four searches from the best gear again, not the worst

The starting assignment named for putting the best items on the strongest heroes was doing the
opposite. It walked the spares best-first and gave each one to the first hero that could wear it, so
a hero eligible for several items in a slot kept whichever arrived last — the weakest — while every
better item it displaced sat back in the bag behind the walk, never reconsidered. With three weapons
and two heroes it seated the weakest weapon on the strongest hero and left the other hero's weapon
slot empty.

Plans were never wrong because of this: the search keeps whichever of its four starting points ends
up best, and a plan is never adopted unless it beats the roster it started from. But one of the four
was spending its whole climb starting from a strictly worse position than the other two, so it added
none of the variety it exists for. Fixing it means Team Plan searches from four genuinely different
places, and a roster with several comparable items in one slot can now find a better plan than it
did before.
