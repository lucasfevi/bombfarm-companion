---
"@bombfarm/web": patch
---

Removes the Farm Respec Advisor's objective picker. The solver now always optimizes gold/hr —
offering Chests/hr or a gold/chests blend as a choice was misleading without also being able to
filter which chest a build is farming for, so the choice is gone rather than kept and mislabeled.

The toolbar is Optimize alone, welded to nothing, with the lower-bound gain callout beside it.
The panel's chest explainer, which only ever had something to say under a non-gold objective, is
gone with it. The gold tile's "gives up N gold/hr for this objective" line turns out to have
already been unreachable under a pure gold objective before this change — the solver always
considers the current build as a candidate, so a gold-optimizing proposal can only match or beat
today's gold/hr, never fall short of it — so removing the objective choice only made that
branch's deadness official; it is removed along with its string.

The Farm Ranking board's Next Point ranking mode reads the same store field the picker used to
set, so it becomes gold-only too as a direct consequence — a user-visible change in a surface this
rework did not otherwise touch. `@bombfarm/domain`'s `FarmObjective`/`resolveFarmObjective` are
untouched: every caller simply stops passing an objective, and the domain already defaults to
gold when none is given.

A stored `farmObjective` value from before this change is inert — it loads without error and is
ignored, since gold is now the only objective the app can ever solve for.
