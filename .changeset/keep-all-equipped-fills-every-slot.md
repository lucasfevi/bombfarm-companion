---
"@bombfarm/domain": patch
---

"Keep every hero geared" now fills every empty slot it has a piece for, as its hint promises. Filling a slot is often worth exactly nothing to the gold objective — gold/hr moves only when a hero crosses a whole hits-to-kill step — so the search never proposed it, and the pass that fills empty slots only ran when the search had already proposed some other move, then lost a tie against "change nothing" for being one more chore. With the switch on, that pass now runs on every plan and a fill into an empty slot counts in the plan's favour on a tie; with it off, nothing changes.
