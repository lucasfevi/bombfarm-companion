---
"@bombfarm/domain": patch
"@bombfarm/hero": patch
"@bombfarm/desktop": patch
---

The Power breakdown now draws the Cooldown chart as checked up to 76.64% instead of 17.85%, since heroes at 44%, 55% and 80% Cooldown reproduce the game's own Power figure. A hero at the 80% Cooldown cap no longer shows a false gap against the game's figure: the sheet hides how many points sit past the cap, so the app now reads them back from the game's stored Power, and the hero's spent points add up to its level.
