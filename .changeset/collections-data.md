---
"@bombfarm/contracts": minor
"@bombfarm/game-api": minor
"@bombfarm/domain": minor
---

The app can now read the Collections state and work out each book's bonus

The app now reads the game's Collections: the cap, the total and the uncapped sum for each of the ten bonuses, every set with the pieces sacrificed on each rarity page and what it grants, and every piece with the pages it is sacrificed on. On top of that it works out each book's numbers: what each page contributes, what one more piece or a completed page would add, how much of each bonus is still to earn, and which open slots the free items in your inventory would fill. If the game changes what it sends, the app keeps the last good reading instead of showing a half-read one.
