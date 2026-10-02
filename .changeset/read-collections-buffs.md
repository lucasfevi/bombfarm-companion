---
"@bombfarm/domain": minor
"@bombfarm/farm": patch
"@bombfarm/team-plan": patch
"@bombfarm/hero": patch
"@bombfarm/desktop": patch
"@bombfarm/web": patch
---

The app reads the Collections bonuses the game added on 2026-09-30

Burning a full equipment set now unlocks an account-wide bonus, and the game started folding those
bonuses into every hero's stats. The app did not know about them, so working a hero's spent points
back out of its stats came out too high for every hero on an account with any collection unlocked —
and every one of those heroes was left out. On the desktop the Optimizer showed no heroes at all and
the Farm board left the whole roster out; an imported save on the web planner did the same.

Each bonus is now read and applied where the game applies it:

- Energy, Critical chance and Cooldown multiply the hero's stat; Critical damage multiplies the part
  of it the skill tree does not add. Hero stats, DPS and the stat breakdown (which gains a
  "Collection" step) include them.
- Damage and Experience are already inside the skill-tree totals the game reports, so they are not
  applied a second time. Pricing a skill-tree node no longer drops the Damage bonus from the total.
- Gold multiplies gold per prop on top of the skill tree's Team Coin bonus — measured: every prop
  the game paid out reproduces to the coin that way. Luck adds to the squad's drop luck; how it
  combines with the skill tree is not measured yet.
- Cage and boss and Forge are read but not applied until their effect is known.

The game's own skill-tree read is recognised again (it carries the new Collections field), so the
desktop no longer discards the stored skill tree each time it starts.
