---
"@bombfarm/desktop": minor
"@bombfarm/contracts": minor
"@bombfarm/ui": minor
"@bombfarm/web": patch
"@bombfarm/farm": patch
"@bombfarm/team-plan": patch
---

One rail of refresh controls in the status strip, the same on every tab.

**Four feeds, each with its own ring and its own press.** The strip at the foot of the window
now lists what the app keeps asking for on your behalf — **Account** (read every minute while the
window is in front, every five in the background), **PVP** (the standing, read when its tab
opens and by every duel), **Prices** (the published price list, checked every fifteen minutes)
and **Updates** (every twenty) — each as a small ring beside its name. The ring is the time left
until the feed refreshes itself: full the moment a read lands, draining to empty as its clock runs
down, so a glance says whether pressing is even worth it. A read in flight spins; a landing
lights the ring's centre for a moment; the PVP standing, which has no clock of its own, draws a
dotted ring. No figures at rest — the last read, the cycle and the countdown are the tooltip's.
Each item is a button. A press that starts nothing — the game closed, a second press inside the
floor, no server behind a fixture — shows the one word "refused" beside the ring, with the reason
in the tooltip; only "out of date" takes the warn tone, never age and never a refusal.

**Refresh all, one after another.** The button at the rail's end — itself a ring that fills a
quarter per step — presses all four in turn, Account → PVP → Prices → Updates, counting the
steps, and moves on past a refusal instead of stopping. The feeds the tab on show does not read
are drawn muted. Prices can be asked for by hand for the first time: a new `market:check` runs the same
conditional request main's own clock makes, with a thirty-second floor.

**The screens lose their refresh buttons.** The controls that used to sit over the Farm board's
heading, over the Forge bag, over the Optimizer's title and inside the PVP Standing panel are gone;
the rail's Account item speaks for whichever of those screens is showing — its line reads "out of
date" once the live account has moved past the copy the screen computed from, and its press
recomputes over the account in hand and then asks for a new read, as those buttons did. Every other
screen follows the live account, so the item shows the last account read and a press asks main to
read it again.

The Optimizer screen loses its title line: the tab and the nav already name it.

**The connection, and the Live tab wears it.** The "Connected" chip at the strip's left becomes
a pulsing green dot beside the word — steady amber with the age when the stream has gone quiet,
hollow beside "Not running" — with no meter, because the game is not polled: it is what every
other feed is read from. The Live tab in the top bar carries a small dot at its corner in the same
state, and hovering either says the same sentence. The "Streaming live from the game" pill leaves the Live screen —
a live screen is its own evidence — and a gap is now a sentence in the warn tone, not a chip. The
web download page's replica of the Live screen follows: the dot on its Live tab, no pill. The
design system's `StatusChip` is retired with no reader left; `AppNav` items take an optional
corner mark.
