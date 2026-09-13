---
"@bombfarm/domain": patch
"@bombfarm/web": patch
"@bombfarm/desktop": patch
---

Follow the wiki as published on 2026-09-13, restate Diamond Tip as flat points, and let the farm
point search price team auras per candidate.

**Two game values moved** since the 2026-09-02 bundle, and both reach a screen:

- **Return Bonus** is now +50% (was +40%) and +100% for VIP (was +80%). The Farm board's
  Return Bonus estimate on both hosts scales gold, XP and every drop rate by ×1.5 / ×2 instead of
  ×1.4 / ×1.8.
- **Misericórdia** executes rock below 0.75% of its HP per level (was 1.25%), so 15% at rank 20
  instead of 25%. Every DPS figure for a hero carrying it — the Heroes seat, the Farm board, the
  Optimizer — prices the smaller threshold, and the ability's effect text on both hosts says 0.75%.

The other moved sections (achievements list, market access, the stash cap's field names, a new
600 s swap timeout on phases, and the new Boost, daily-reward, ranking-prize, PvP and rune
sections) back nothing the app models; the bundle's 600 phase rows and every other constant are
unchanged.

**Ponta de Diamante (Diamond Tip) adds flat penetration points**, held outside the pool that gear
and spent points scale — the shape the 2026-09-02 patch gave it. It was modelled as multiplying
the hero's natural penetration (×21 at rank 20), which is what the game did before the patch. A
2026-09-13 live read settles it: a ★2 rank-20 carrier exports 64.1 penetration against 44.1
composed without the ability — a residual of exactly 20. Every carrier's penetration column, the
stat breakdown's Diamond Tip line, point inference on imported saves (which no longer reports
hundreds of negative penetration points for a carrier) and every DPS figure downstream move with
it. Captures taken before the patch keep the old reading and are marked as such.

**The Farm respec search now prices the team auras for each candidate it tries.** It used to hold
them at the starting build's totals, so a carrier of Fôlego de Mineiro that bought energy was
scored as if its aura reached the field no more than before — and solving a roster, applying the
proposal, and solving again could find a further gain. Each candidate now carries its own aura
totals, so a search and a re-search score the same squad, and the pipeline runs once per hero
instead of twice.
