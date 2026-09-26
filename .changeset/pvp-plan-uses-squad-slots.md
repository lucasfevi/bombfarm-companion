---
"@bombfarm/domain": patch
"@bombfarm/team-plan": patch
"@bombfarm/desktop": patch
"@bombfarm/web": patch
---

The Optimizer's PVP objective now plans for the squad slots your account actually has. A duel squad's slots grow with the squad house (two, four, six, eight, then nine), and the desktop app already read yours from the game with the PVP standing, but the plan always assumed nine. An account with six slots could get a plan for a squad of seven or more that it cannot field. The plan now scores the duel on a room with your own slot count, the Duel field reads "5 of 6 fielded" against that number, and the warning says how many slots you have and how many heroes to move to Donate. Until the game has reported your slots, the plan assumes nine, the top house's count, and the field's tooltip says so. A change in your slot count after a PVP plan is built marks the plan out of date. The web planner has no PVP data and does not offer the objective. Its Optimizer explanation no longer says a duel always seats nine. In `@bombfarm/domain/combat-window`, `PVP_SQUAD_SLOTS` is now `PVP_TOP_HOUSE_SQUAD_SLOTS`, `pvpSquadSlots()` resolves a reported count to the slots a plan uses, and `TeamPlanInput` gains `pvpSquadSlots`.
