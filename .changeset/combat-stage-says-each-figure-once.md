---
"@bombfarm/hero": minor
"@bombfarm/desktop": minor
"@bombfarm/farm": patch
"@bombfarm/web": patch
---

Say each combat figure once, and stop drawing three sections that could never fill.

**A hero's field time was reported as 4.495,4%.** `uptime` is already a percentage — field seconds
over field plus rest, times 100 — and the combat panel multiplied it by 100 again. A hero on field
45% of the time read `4.495,4`. It reads `45,0` now, and this was wrong on the phase explorer too.

**The Combat stage stated eight figures twice.** Damage through, normal hit, critical hit, field
time, fuse, uptime and both DPS figures appeared bare in the hero panel and again, each with the
ledger that produced it, in the breakdown below. The bare copy is gone: it was the same number
with less behind it. What the hero panel still says is what only it says — whether the hero
pierces the phase, the average hit its build lands, the floor its fuse cannot go under, the
ceiling its cooldown reduction stops paying at, and the prop table.

**Three empty sections, on any screen that cannot fill them.** A gear comparison needs a second
loadout, which only a Copy gear button can create, so a read-only screen drew a heading over
nothing. The Points panel held a blank line open for reset advice that names a button that screen
does not have. Both now appear only where something can fill them — as the Preview column already
does. The advice line still holds its space on the planner, where it comes and goes.

**The stat sheet puts its units on the figures**, like the Points table beside it: `1.680,00%`
under a row named `Crít`, not `1.680,00` under `Crít %`. The team-plan breakdown keeps the unit on
the label, because its table formats its own numbers and has nowhere to put one.
