---
"@bombfarm/domain": patch
---

More crit chance no longer lowers the predicted gold/hr. When a hero needing many hits per prop reached exactly 100% crit chance, the farm model counted up to one extra hit per kill, so a Skill Tree node or a point that pushed a hero onto the cap could price as a loss. The same fix covers Detonação Dupla's second blast.

Hits-to-kill on tough props (more than 60 hits) is also more accurate now: it counts the damage the killing hit wastes past the prop's HP, which the model used to leave out, so it read about half a hit per kill low. Expect slightly lower clear rates and gold/hr on high phases; phases where heroes need 60 hits or fewer do not change.
