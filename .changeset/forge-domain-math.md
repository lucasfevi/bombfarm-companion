---
"@bombfarm/domain": minor
---

Teach the planner the forge, ahead of the screen that will use it.

**The planner now knows the forge's rules.** An item climbs from +0 to +15 one roll at a time.
Rolls up to +8 always land; from +9 on the odds fall from 80% to 20%, a miss drops the item back
to +8, and a miss on the last roll for +15 drops it all the way to +0. Gold is charged whether the
roll lands or not. Below +8 a single call takes the item straight to +8 for the sum of the eight
rolls it replaces. With those rules the planner can say, for any item and any target, how many
rolls a climb is expected to take, how many times it is expected to fall back and jump to +8
again, and what it is expected to cost — and, from a seeded run of simulated climbs, what a run of
bad luck costs at a chosen percentile.

**The gold cost is exact, and it comes from the wiki.** Every roll cost — thirty item levels, six
rarities, fifteen steps — is carried exactly as the wiki's forge page publishes it, not
approximated. The table also has a closed form, (120 + 8 × level + 100 × rarity) × (step + 1)² ÷ 4,
and a test holds every one of the 2,700 cells to it: a rebalance that only changes the numbers is
a refresh of the data file, and one that changes the shape of the cost fails loudly instead of
drifting.

**Nothing is on screen yet.** This change is the arithmetic only; the Forge tab that uses it comes
in a later change.
