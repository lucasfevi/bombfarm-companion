---
"@bombfarm/desktop": patch
"@bombfarm/domain": patch
"@bombfarm/game-api": patch
---

The app reads your account cleanly again after the game added Forge Essence

The game added a Forge Essence balance, fusion pity counters and per-item essence values to its
account and inventory replies, and the app flagged both reads as having drifted. They are now recognised: the
account and inventory read as complete again, and the essence balance and each item's essence value
are kept for the Deconstruct page instead of being discarded.
