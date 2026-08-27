---
"@bombfarm/contracts": minor
"@bombfarm/game-api": minor
"@bombfarm/desktop": minor
---

The Live screen now shows who is on the field, not only what they are called. A hero row carries
a rarity-tinted avatar tile, the rank letter, the name, its stars and its rarity — the same
identity the Planning roster shows.

Rarity and stars reach it the way the name and rank already did: joined from the roster by id in
the main process, where the entry carrying them was already being read. They follow the same
absence rule as the fields beside them, so a hero the roster has not caught up with renders as
its id against a neutral frame rather than with anything invented to fill the gap, and a grade
still never appears without the name it arrived with.

The portrait itself is the same for every hero. The in-game skin index is not carried on this
data path, so rarity is what distinguishes one tile from another today.
