---
"@bombfarm/hero": minor
"@bombfarm/desktop": patch
---

Move the roster rail, the card board and the toolbar that governs them into `@bombfarm/hero`, so
the web planner draws the same three the Heroes screen does instead of a second copy. Two screens
drawn twice is a hazard this repo already carries once and did not need again: the pair would have
to be changed together, and nothing would say so when one of them was not.

They take their strings as a prop, like every other panel in this package, against a
`RosterBoardCopy` contract the host satisfies from its own dictionary — which is what lets the two
apps use their own words for the same flag, where this one calls a hero out of the rotation
inactive and the planner calls it disabled. The layout switch moved inside the toolbar rather than
sitting beside it, so the fourth thing you can ask of a roster is not placed differently by each
host. Nothing on the Heroes screen changes to look at.

The ordering, the filtering and the list-versus-board rule move with them, tests and all, and the
card keeps the explicit `memo()` it was already written with — the React Compiler does not run
over a package a host transpiles, so a component that reaches a host that way keeps only the
memoisation its own source spells.

Fixes an ability tile no hero on the roster owns being pressable. It is drawn dimmed and marked
unavailable, but the design-system tooltip drops a `disabled` attribute from its trigger on
purpose — a disabled element receives no hover, and the tooltip naming the ability is the whole
reason an unowned ability is shown at all — so nothing was refusing the press. Selecting one
filtered the roster down to no heroes, with the same dimmed tile as the only way back.
