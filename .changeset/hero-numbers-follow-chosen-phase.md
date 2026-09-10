---
"@bombfarm/web": patch
---

Compute the hero workspace's combat numbers at the phase you picked, so the planner and the phases explorer stop disagreeing about the same hero.

The workspace read the farm phase the imported save reported — a value nothing in the app ever moved — while the phases explorer computed at whatever phase you had selected there. Picking any phase made the two screens print different hits, uptime and DPS for one hero, with nothing on either screen to say why.

Both now read the same phase: your pick when you have made one, and the account's own farm phase until then, so a freshly imported account keeps answering for the phase it actually farms.
