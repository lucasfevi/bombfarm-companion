---
"@bombfarm/domain": patch
---

The optimizer no longer buys crit chance past the cap, whatever it is optimizing for. The crit
aura is priced as the rotation average, which made points between 80% and about 84% on the sheet
look worth full value while the carrier is off the field and worth nothing while it is up, so a
hero near the cap was sent past it. Gold, gate-clear and duel plans, and the farm point searches,
now stop crit chance where the sheet plus the aura at full strength reaches 100%.
