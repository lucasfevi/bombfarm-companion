---
"@bombfarm/web": minor
"@bombfarm/desktop": patch
"@bombfarm/account": patch
"@bombfarm/domain": patch
"@bombfarm/ui": patch
---

Skill Tree on the web planner, both gold-per-hour figures, and rates to three significant digits.

The imported save's owned nodes now persist with the account, so the planner grows a Skill Tree
tab between Inventory and Account — the same drawing and ranking the desktop tab already shows.
Gold per hour prints the spread mean and the figure at this roster, side by side, and rates keep
three significant digits so `4.30m/h → 4.34m/h` stays readable.
