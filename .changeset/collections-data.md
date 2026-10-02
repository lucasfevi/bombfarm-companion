---
"@bombfarm/contracts": minor
"@bombfarm/game-api": minor
"@bombfarm/domain": minor
---

The app can now read the Collections state and work out each book's bonus

The game's Collections panel serves the whole catalog of set books together with the account's progress in each one. That body is now recognised by its exact shape and read into a snapshot: the cap, the total and the uncapped sum for each of the ten axes, every set with the pieces sacrificed on each rarity page and the bonuses it grants, and every piece with the pages it is sacrificed on. Anything malformed or out of range is refused whole rather than drawn half-read, while a key the game adds is ignored and counted so the change can be flagged instead of blanking the screen. On top of that, the Collections board is computed from the snapshot: what each page of a book contributes, what one more piece or a completed page would add under the game's partial-page rule, how much of each bonus is still to earn, and which open slots the free items in the bag would fill.
