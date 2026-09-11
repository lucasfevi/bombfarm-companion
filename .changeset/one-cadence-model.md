---
"@bombfarm/domain": minor
"@bombfarm/web": minor
"@bombfarm/desktop": minor
"@bombfarm/hero": patch
---

Price every DPS figure on one bombing-cadence model — the Farm page's measured one — and retire
the advisor's serial model.

**Two models printed DPS.** The hero strip, the Points ranking, the reset-advice gate, the Combat
stage on both apps and the Optimizer's damage objective read a serial cycle, `1 / (fuse + 0.15 s)`,
in which Speed did not appear: a Speed point ranked at 0% forever and Marcha Acelerada was worth
nothing. The Farm page read a measured cycle — the longer of the fuse and the walk to the next
plant, averaged over hop lengths measured in real clears and packed closer on denser difficulties
— so a hero's bombs per second on the Combat stage and its plants per second on the Farm page, at
the same phase, were two different numbers.

**Now there is one.** The advisor's bombs per second is the inverse of the Farm page's cycle at
the farm phase's own difficulty band. Speed shortens every hop the fuse does not already cover,
and is a real next-point candidate (about 1.1% a point on a typical hero). Cooldown reduction pays
only while the fuse is the longer leg: for a hero walking around two cells a second it stops
scoring at roughly 53%, where the serial model had it paying through to the 80% cap. A build with
every point in cooldown still trips the reset gate — harder than before.

**Every DPS figure moves, on both apps**, typically down by about a third at mid cooldown
reduction; the Bombs/s breakdown prints the one formula with the fuse, walk speed, band and
resulting cycle substituted, and the "How the math works" text describes the measured cycle.

**The accepted cost:** the measured cycle's approximations — a hop histogram fitted at one
difficulty band and scaled to the others, a density term that runs optimistic at the easiest band,
latency constants calibrated on squad clears — now reach per-hero figures. Those are errors of
degree; Speed doing nothing was an error of kind. A hero priced alone is priced at squad density,
as the Farm page already priced it.
