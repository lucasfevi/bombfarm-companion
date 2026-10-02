---
"@bombfarm/domain": minor
---

The planner can score a squad on one equipment set's item chests per hour

A new farm objective counts only the chests of the set you are collecting, over the phases where
that set drops — a phase shared with a neighbouring set counts half its chests, since the game
splits them evenly. Luck becomes a place to put stat points, because it multiplies every chest
roll, and the point search weighs it against clear speed: every point in Luck is one out of
attack, and a slower clear drops fewer chests. No clear is too slow to count, so a squad that
struggles with a set's phases still gets a real figure, and the plan reports how long a clear of
its phase takes so a slow one can be flagged. Only a set that drops past your furthest phase, or
on phases the squad cannot clear at all, is reported as unfarmable.
