---
"@bombfarm/web": patch
"@bombfarm/hero": patch
"@bombfarm/desktop": patch
---

The Gear compare scoreboard now scores the clone the same way it scores your current gear. On a
hero whose own entry pulse is up — the ability that lifts damage for a stint — the two columns were
read off different bases, so a clone copied straight from current gear printed a Sustained DPS and
a Hit well below the figures right beside it while the delta under them still said +0.0%. Copy your
gear now and both columns read the same numbers. The percentage deltas are unchanged, and the
hits-to-kill rows still count a hit at the level the field sits at rather than an average.
