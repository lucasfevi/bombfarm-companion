---
"@bombfarm/domain": minor
"@bombfarm/web": minor
"@bombfarm/ui": patch
---

Optimize build now picks what it optimizes for, and the roster-wide reset banner is gone.

A target select is glued to the **Optimize build** button on the Points tab. **DPS** is what the
button always did — the best allocation the search found for that hero's sustained DPS. **Farm**
searches the same points against your farming rotation's gold per hour instead: the whole
rotation is scored, only the open hero's points move, and the result is reported in gold per hour
rather than DPS. It is its own setting, independent of the Next point panel's ranking mode, so you
can rank the next point one way while reallocating a whole build the other.

The banner across the top of the planner that named every hero a reset might help is withdrawn. It
restated, roster-wide, advice already carried for the hero you are looking at — the warn border on
the hero strip and the gain line inside the Points panel, both of which stay. Those two now say
that the gain they found is a sustained-DPS one, which an unqualified "possible gain" no longer
settled once the button could also search for farm rate.
