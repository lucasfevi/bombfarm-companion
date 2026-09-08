---
"@bombfarm/web": patch
---

Three things the Optimizer page was saying that were not true.

**It never moves Luck, and never said so.** The point search runs over `HeroSheet`, and Luck is not part of it — no plan can shift a point into or out of Luck in either direction. That is fine under DPS, where Luck earns nothing. Under Gold / hr it is a real limit worth stating: Luck raises drop rates and therefore gold per hour, so the page was optimizing gold while holding one of its inputs still. Assumptions & limits now says so, in both directions, whenever a plan could have moved points at all.

**"No phase pinned" described only half of what happens.** The hint said the search would pick the best phase the squad can hold and report which — true when scoring gold, false when scoring DPS, where an unpinned phase means the account's own current phase and no search at all. Since None is the default, that was the state most DPS users saw. The hint is now a pair, and each half describes what its objective actually does.

**The Optimize button's accessible name ignored Allowed changes.** It read "Build a team plan of gear moves and point resets" whatever the setting, so someone using a screen reader on a points-only plan was told it would move gear. The visible label is unchanged; the accessible name now names only the work the current setting permits.
