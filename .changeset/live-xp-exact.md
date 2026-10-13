---
"@bombfarm/desktop": minor
"@bombfarm/contracts": minor
"@bombfarm/game-api": minor
"@bombfarm/web": patch
---

The Live screen's XP figures are now exact. XP per hour, the session XP total and a new measured XP per prop are read from the XP the game reports for every prop your heroes destroy, with every bonus included — the Pass, the Return Bonus, a Boost and hero runes — instead of being estimated from the props and reading up to half low. The measured XP per prop sits beside gold per prop and says how far it runs from the map's estimate. The map's estimated XP per prop now counts a running Boost and the XP runes of the heroes on the field (weighted equally across them), and its gold figures count a gold Boost, so the two no longer drift apart under a Boost; when the account read carries no usable XP multiplier the estimate shows "—" instead of a guess. The download page's drawing of the Live screen shows the new figure.
