---
"@bombfarm/domain": minor
"@bombfarm/farm": minor
"@bombfarm/team-plan": patch
"@bombfarm/web": minor
"@bombfarm/desktop": patch
"@bombfarm/account": patch
---

The Farm board's XP per hour is now right. It never applied your account's XP multiplier, so it read low by that whole factor (more than half low on a strong account); it now does, and when an imported save carries a missing or zero XP multiplier the column shows "—" instead of a guess. With no save imported, the web planner still prices XP, without your account's XP bonuses, and an ⓘ beside the board's title says so. A hero's XP rune now counts too: it multiplies the XP of the props that hero destroys. The Phases panel's XP per prop now includes the Return Bonus, the Pass and your squad's XP runes (each hero's weighted by its share of the kills), so it agrees exactly with the Farm board's row for the same phase. The web planner's Farm board has a new Boost control beside Return Bonus and Pass — one switch each for gold, XP and drop — and a running Boost adds its +100% to the same sum as the Return Bonus and the Pass, on the Farm board, the Phases panel and the Optimizer alike. The desktop app reads the running Boosts from the game instead: its Farm board shows which axes are boosted and prices them, as does its Optimizer, and a Boost starting or ending marks both as out of date so a refresh picks it up. The Optimizer now prices gold with the Farm board's Return Bonus switch too, so its gold per hour matches the board's with the switch on, and its list of what changed since the plan names the switch, and each Boost axis, when it moves.
