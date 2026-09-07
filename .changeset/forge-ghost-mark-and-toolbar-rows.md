---
"@bombfarm/contracts": minor
"@bombfarm/game-art": minor
"@bombfarm/desktop": minor
"@bombfarm/web": patch
---

A forge run holds the next roll's place on the chart, the bag's columns stop moving as you scroll,
and gold figures carry the game's coin.

**The chart says a roll is in flight, so nothing says `pausing…` any more.** A run leaves a gap
between one roll and the next, and the header used to fill that gap with a word. The word was
effectively always on: the gaps are drawn from 700ms to 2,500ms, so about two in five cleared the
threshold meant to catch only the long ones, and the word blinked every few rolls. There is no
threshold now. Where the next mark will land, the chart draws a hollow accent circle with a short
dashed stub back to the last real one, at the level the piece stands on — because where it lands
is exactly what nobody knows yet. Both breathe together over 1.4s, or hold still at a middling
opacity for anyone who has asked for less motion. When the roll settles, the real mark appears at
that same x and the ghost is gone, which reads as a shape filling in rather than a blink. The mark
covers the first roll of a run too, not just the gaps between rolls, so there is always either a
ghost or a fresh mark and never a moment of nothing.

**The bag's columns held still while it scrolled.** The gear table only keeps the rows you can see
in the document, so the browser was re-measuring the column widths from whichever slice happened
to be mounted, and the columns visibly jumped as you scrolled. Measured on a 137-row bag, the
Forge column went 119px at the top to 144px deep in it — a fifth wider — while Item, Slot and
Equipped by all shifted to pay for it. The table now sizes its columns once, from the column set
itself, and gives the item name whatever width is left. The same table draws the web planner's
inventory list, so its columns hold still now too.

**Every gold figure on the Forge screen carries the coin.** The plan's expected, bad-run and
wallet figures, the run's spend and its by-rung gold, the result block's three figures, and the
ledger's gold column, totals and header — one coin, sized to the text it stands beside, and never
on a figure that is not gold. The ledger's two summary lines print their gold as its own clause
for that reason: a coin in front of `2 runs · 13 rolls · 2 fails` would have marked three counts
that are not money.

**The result block says how far the run ran from its plan.** Beside the spend, as a signed whole
percent against the expected figure — `−20%` in the up colour under the plan, `+87%` in the warn
colour over it but inside the bad run, `+282%` in the down colour past the bad run.

**The Forge toolbar is three rows, and one dropdown fewer.** The search field takes the first row
to itself, full width; the hero, slot and forge-level dropdowns share the second with the result
count and Clear; the rarity chips have the third. Who wears a piece is a chip there now — the same
`Equipped` chip the Inventory toolbar has — instead of a three-state dropdown, and it appears only
when the bag actually holds a piece somebody is wearing. Asking for "nobody wearing it" while a
hero was chosen could only ever show an empty table; with one chip that cannot be asked at all,
and with a hero chosen the chip goes away entirely, because every row is already one they wear.
