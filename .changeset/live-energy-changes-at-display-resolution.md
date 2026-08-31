---
"@bombfarm/contracts": patch
"@bombfarm/desktop": patch
---

Stop the Live tab redrawing itself four times a second to show the same numbers.

Per-hero energy rides the fast channel as a raw fraction, and it moves on every frame: four
consecutive readings off the wire were 0.28425…, 0.28389…, 0.28377…, 0.28365…. The bar is one
percent wide per point and the reading beside it has no decimals, so all four are the same
picture — but every one of them counted as a change, so the main process emitted, the store
republished, and every hero row re-rendered, continuously, for as long as the screen was open.

Both sides now ask whether the *displayed* percentage moved, through one shared
`energyDisplayPercent` in the contract rather than two comparisons that could drift apart. Nothing
on screen changes: the bar and the reading are drawn from that same whole percent already, and
their agreement is asserted on the running app.

Three things underneath had to change for that to bite, each a defeat of memoisation on its own:

- The store replaced every slice of a fast update with whatever arrived, so a tick that moved only
  the gold balance still handed over a brand-new countdown array saying exactly what the old one
  said. Each slice now keeps the reading it already holds when the new one agrees.
- A hero row was handed a hero merged with a fresh energy figure, which compares by identity. The
  reading now travels beside the hero as a number, so one hero's energy can move without
  re-rendering the twelve rows around it.
- The earnings panel rebuilt two Base UI tooltips — provider, root, trigger, portal, positioner,
  popup — four times a second to draw two words that depend only on the language.
