---
"@bombfarm/domain": minor
"@bombfarm/ui": minor
"@bombfarm/web": minor
---

The Phases board's Economy panel was showing XP per prop straight from the wiki, with no account
boost applied — every other "yours" figure on that panel (gold included) already scales with your
account, XP just didn't. It now reads a wiki/yours pair, same as gold: "yours" is the wiki value
times your account's XP multiplier (`skills.totals.xp_mult` from your save).

There's also a new **Drops** panel on the Phases board, showing each drop chance the game's own
tooltip shows at that phase — item/hero chest, ready key, time chest, gem chest, stone chest —
each as a wiki/yours pair, filtered to only the drops that actually roll on that phase (a gate
phase shows chest + time + gem + stone; a non-gate phase shows chest + key). "Yours" is the wiki
rate times `(1 + your on-field squad's average luck)`, reconciled against two live in-game
tooltips.

The Account import summary now also shows your account's XP multiplier alongside the existing
team-coin percentage.
