---
"@bombfarm/domain": patch
---

Fix the skill tree's crit-damage node being charged as a percentage of the hero's roll when the
game adds it flat, which invented a stat point nobody spent.

The node was modelled percent-of-base on the strength of the game's own wording, and no capture
carried a nonzero value, so nothing could tell the two shapes apart. A capture with a nonzero one
separates them outright: all 15 heroes on the account gain the SAME crit-damage percentage points
over their birth roll, across rolls spanning 45.03 to 73.13 and levels 1 to 97. It is flat, like
every other crit-damage term — the stat point and Golpe Brutal both already are.

Charging it against the roll under-credited the tree on any hero whose crit-damage roll is below
100, and point inference charged the unexplained residual to crit-damage points. On a level-97
Bellatrix the tree was credited 5.54 of the 8.17 it actually gave, and the 2.64 left over became
`2.64 / 5 = 0.53` — one phantom point, rounded up. Her Stats panel read 78.27% crit damage where
the game exported 75.91%, and the point-reset panel offered 98 points to re-place on a hero that
can only ever hold 97. With the shape corrected, every hero solves to a whole-number point vector
with zero inference issues, each landing exactly on its level.

Separately, and as defence in depth: the reset panel's budget is now clamped to the hero's level,
so a bad point vector from anywhere upstream can no longer be sold as a respec proposal larger
than the game allows. The optimizer's budget already carried this clamp; the reset tier, which is
the one the panel actually shows, did not.
