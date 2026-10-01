---
"@bombfarm/domain": minor
---

The planner can score a squad on one equipment set's item chests per hour

A new farm objective counts only the chests of the set you are collecting, over the phases where
that set drops — a phase shared with a neighbouring set counts half its chests, since the game
splits them evenly. Any phase the squad takes longer than 20 seconds to clear is left out, so the
answer is always a phase you can farm quickly. Luck becomes a place to put stat points, because it
multiplies every chest roll, and the point search tries Luck-heavy builds without ever trading the
quick clear away for them. When no phase of the set clears in time — or the set drops only past
your furthest phase — the plan says so and names the phase closest to farmable instead of a figure.
