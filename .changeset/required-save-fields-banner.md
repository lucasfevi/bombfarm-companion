---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Say when an imported save is missing account data, instead of planning around a guess

Some values only your save can supply — your skill tree, your House and its level, the phase you
are on, and the furthest phase you have reached. Every panel that shows them is read-only, so a
save that leaves one out leaves the planner permanently wrong about it, with nothing on screen
saying so.

The furthest phase is the one that costs money. Without it, the planner has no ceiling to respect
and considers all 600 phases, so the Farm Respec Advisor can tell you to spend real gold moving
toward a phase you cannot enter yet — and nothing in the recommendation hints that it is
unbounded.

An import that is missing any of the five now says which ones, in a banner under the header on
every page, and asks for a fresh export. The import still goes through: your roster, your gear and
everything else in the save land exactly as before, and the banner is the only thing that changes.
Nothing already stored is discarded or rewritten — an account saved before this existed keeps
working untouched and stays quiet until you import again.
