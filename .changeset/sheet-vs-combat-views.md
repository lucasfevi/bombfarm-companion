---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Add `gameSheetView`, a display-time clamp matching the game's exported sheet (crit chance at 100%, CDR at 80%; penetration is never clamped). The Planner's Stats panel now shows an "Over cap" column so a player can see how much of an over-cap stat is being wasted, without changing the underlying uncapped `total` the telescoping columns sum to. The Team Plan hero panel now shows two stacked stat grids — "Hero sheet" (capped, matching the in-game panel) and "Combat stats" (uncapped, aura-inclusive) — instead of one combat-only grid.

Fix `selectTreeSheetTotals` (the planner store's `TreeSheetTotals` builder used by level/stars/gear recomposition and by Team Plan scoring), which had been missed by the prior keystone sheet-math correction: it hardcoded `critDmgMult: 1` and never carried `glassCannon`/`tempoDobrado` through at all, so every hero sheet recomposed from store state — including the whole Team Plan objective — ran Glass Cannon and Tempo Dobrado free even for accounts that own them. Glass Cannon's crit-damage multiplier (`skills.totals.crit_dmg_mult`) is now persisted on import (`TreeState.critDmgMult`, defaulting to `1` for existing saves) instead of re-derived from the `glassCannon` boolean, matching how `abissoBase` is already persisted.
