---
"@bombfarm/desktop": patch
"@bombfarm/domain": patch
"@bombfarm/game-art": patch
---

A game update that adds or removes a field no longer makes the app show old data. Before, one removed field that nothing in the app uses (an item's sale value, a hero's market flag) made the app throw away the fresh read and keep showing the last good one until a new release shipped. Now fields the app does not use can disappear without any effect, and when a field the app does use goes missing, the app still shows what the game just sent, and tells you what it could not use. A hero missing something its sheet is built from (its birth stats, level, stars or a piece of gear's forge level) is left out of the calculations on its own, with a small dot on its portrait that explains why on hover. If the game stops sending your skill tree, the app keeps the last tree it read and says so in a banner at the top of the window, or says it cannot read the tree when it never saved one. A piece of gear the game stops saying who wears is matched from the hero's own record, or left out alone if no hero names it.
