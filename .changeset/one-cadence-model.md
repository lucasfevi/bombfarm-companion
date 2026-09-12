---
"@bombfarm/domain": minor
"@bombfarm/web": minor
"@bombfarm/desktop": minor
"@bombfarm/hero": patch
"@bombfarm/farm": patch
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
only on the hops where the fuse is the longer leg — observed directly: a hero that reaches its
next target before its previous bomb has gone off waits on the cell and plants a fifth of a
second after the fuse ends, and when one hero was respecced from 12% to 28% cooldown reduction
that waiting time moved with her fuse, one for one, while a second hero's did not. Where the
crossover falls depends on walk speed and on the field; the model puts it near 53% for a hero
walking two cells a second, and past it the point scores zero, where the serial model had it
paying through to the 80% cap. Nothing is measured past 28%, and the same capture found the model
overstating how much of a fast hero's field is fuse-bound, so a fast hero's cooldown figure reads
high rather than low. A build with every point in cooldown still trips the reset gate — harder
than before.

**Every DPS figure moves, on both apps**, typically down by about a third at mid cooldown
reduction; the Bombs/s breakdown prints the one formula with the fuse, walk speed, band and
resulting cycle substituted, and the "How the math works" text describes the measured cycle.

**The accepted cost:** the measured cycle's approximations — a hop histogram fitted at one
difficulty band and scaled to the others, a density term that runs optimistic at the easiest band,
latency constants calibrated on squad clears — now reach per-hero figures. Those are errors of
degree; Speed doing nothing was an error of kind. A hero priced alone is priced at squad density,
as the Farm page already priced it.
