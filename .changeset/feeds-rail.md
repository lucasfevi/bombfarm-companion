---
"@bombfarm/desktop": minor
"@bombfarm/contracts": minor
"@bombfarm/farm": patch
"@bombfarm/team-plan": patch
---

One rail of refresh controls in the status strip, the same on every tab.

**Four feeds, each with its own age and its own press.** The strip at the foot of the window
now lists what the app keeps asking for on your behalf — **Account** (read every minute while the
window is in front, every five in the background), **PVP** (the standing, read when its tab
opens and by every duel), **Prices** (the published price list, checked every fifteen minutes)
and **Updates** (every twenty) — each as a name over the time it was last read, with a hairline
under it that fills towards the feed's next automatic refresh. That line is the one thing a
timestamp cannot tell you: whether pressing is even worth it. The PVP standing, which has no clock
of its own, draws a dotted line instead. Each item is a button; the tooltip says how the feed
keeps itself fresh and how long until it does. A press that starts nothing — the game closed, a
second press inside the floor, no server behind a fixture — says why in the age's place.

**Refresh all, one after another.** The button at the rail's end presses all four in turn,
Account → PVP → Prices → Updates, counting the steps, and moves on past a refusal instead of
stopping. Prices can be asked for by hand for the first time: a new `market:check` runs the same
conditional request main's own clock makes, with a thirty-second floor.

**The screens lose their refresh buttons.** The controls that used to sit over the Farm board's
heading, over the Forge bag, over the Optimizer's title and inside the PVP Standing panel are gone;
the rail's Account item speaks for whichever of those screens is showing — its line reads "out of
date" once the live account has moved past the copy the screen computed from, and its press
recomputes over the account in hand and then asks for a new read, as those buttons did. Every other
screen follows the live account, so the item shows the last account read and a press asks main to
read it again.
