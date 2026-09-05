---
"@bombfarm/desktop": minor
"@bombfarm/contracts": patch
"@bombfarm/ui": patch
"@bombfarm/web": patch
---

Add the Forge tab, as a planner.

**A new tab, between Inventory and Account.** The nav now reads Live · Farm · Inventory · Forge ·
Account · Settings. Pick a hero and the bag narrows to what that hero wears; pick a piece and the
screen shows what it becomes at a chosen target — every roll on it now and at the target, scaled by
the forge's own flat multiplier, so the figures are exact rather than an average of where a climb
might stop.

**What the climb should cost, from the wiki's own cost table.** For a piece and a target the plan
panel prints the expected number of rolls, the expected gold, and what a bad run costs at the 90th
percentile — all from the forge rules and the roll costs the wiki publishes, carried exactly. The
ladder above the facts shows every risky rung with its odds and where a miss lands, and one line
under them says what a failed roll does, including the one rung that wipes a piece to nothing.

**What one more level buys.** The bag table has a `+1 buys` column: the DPS its wearer gains from one
more forge level on that piece, measured the way the Farm board measures every hero, with a
tooltip giving the next roll's cost and chance. The plan panel prints the same figure for the
chosen target. A piece nobody wears shows a dash, never a guess, and so does an account the board
itself would withhold.

**The button waits for the next change.** Forging is not wired up yet: the Forge button is always
disabled and the line under it says why — the piece is already at the top, the account has no
server behind it, the Settings switch is off, or simply that forging arrives in the next release.
The app now tells the screen where its account came from, which is what lets a fixture account be
refused without a switch ever being consulted.
