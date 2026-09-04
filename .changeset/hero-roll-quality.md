---
"@bombfarm/domain": minor
"@bombfarm/web": patch
---

Keep each hero's roll bounds, and work out how well that hero actually rolled.

**A hero's roll bounds now survive the trip.** Every hero is born with a lowest and a highest
possible value for each of its statistics, and the game says so on import. Until now the planner
read those bounds, used nothing, and dropped them on the floor — they were gone by the time the
hero reached storage, and gone again every time the autosave wrote the hero being edited back out.
They are now carried from the import, through the stored hero record, and through the draft the
editor works on, so a hero that has been opened and saved still knows what it could have rolled.

**From those bounds, two new numbers.** For a single statistic, where its roll landed between the
lowest and the highest that hero could have been born with, as a percentile. For the hero as a
whole, one roll-quality number summarising all of them. Both are computable from a stored hero
record alone — no re-import, no live game.

**Roll quality is placed against the letter the hero already carries, and never overrides it.**
The game grades every hero with a letter, and that letter is the hero's own; the planner treats it
as fact. When the measured roll quality disagrees with it — a hero graded well above or below what
its rolls support — the disagreement is reported as a disagreement, with both values intact.
Nothing recomputes, corrects, or replaces the stored letter.

**Fuse time is now a first-class result.** Both the per-hero combat result and the farming result
report the hero's fuse in seconds, the floor it cannot go below, and the cooldown-reduction cap
that governs it. The two constants are reported separately and on purpose: they happen to coincide
today, but they are equal only by construction, and a balance patch could move either one alone —
so nothing has to infer one from the other, and nothing restates either from memory.

**Nothing is on screen yet.** This change is the data, the arithmetic and the tests that hold them;
the views that show a player how their hero rolled come in a later change.
