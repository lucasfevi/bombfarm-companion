---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Add `gameSheetView`, a display-time clamp matching the game's exported sheet (crit chance at 100%, CDR at 80%; penetration is never clamped). The Planner's Stats panel now shows an "Over cap" column so a player can see how much of an over-cap stat is being wasted, without changing the underlying uncapped `total` the telescoping columns sum to. The Team Plan hero panel now shows two stacked stat grids — "Hero sheet" (capped, matching the in-game panel) and "Combat stats" (uncapped, aura-inclusive) — instead of one combat-only grid.
