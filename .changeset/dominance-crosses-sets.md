---
"@bombfarm/domain": minor
---

Stop the Optimizer handing a hero worse gear than it is holding. Its dominance rule compared two
pieces only within one item definition, on the premise that sets differ in which stats they roll
and so are incomparable. That premise no longer holds: every slot's thirty sets roll the same
stats in the same order, and a roll is `statBase × nivelMult[level] × forja`, so within a slot an
item is fully described by (level, rarity, forge) and the set name is cosmetic. A clay amulet beats
a coal one of equal rarity and forge outright — and the search was still offering the coal.

Dominance is now read off the catalog's own scaled rolls instead of asserted, so it degrades to
"incomparable" by itself if a set ever does roll differently again. It is applied per hero level,
because a dominated piece may be the only one an under-levelled hero can equip.

Comparing across sets also fixes a second, quieter symptom. The gold objective is flat over wide
plateaus — hero damage reaches it through an integer hits-to-kill, and Luck does not reach it at
all — so a swap chain that pays for itself elsewhere could leave a hero holding gear a free piece
beats outright, with no gain available to make the search correct it. Where the plan is already
changing a slot, it now hands over the best piece it could; slots the plan leaves alone stay
alone, so no chore is invented, and each substitution is still scored, because more Energia raises
uptime and on a saturated field that can cost more than the piece gains.
