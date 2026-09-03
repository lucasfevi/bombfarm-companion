---
"@bombfarm/domain": patch
---

Carry the Passagem de Bastão pulse cooldown in the team-plan model, and prove it cannot bind.

The wiki publishes a 600s cooldown between pulses, which the model did not carry — it credited a
pulse on every field entry. That turns out to be right today for a reason outside the ability: a
carrier re-enters once per field stint plus a full House recovery, and the fastest House in the
game recovers in exactly 600s, so no reachable hero can re-enter inside the cooldown. The scored
throughput of every roster is unchanged.

The cooldown term is written out rather than assumed away, and a guard fails if any House ever
recovers faster than it — the point at which the term stops being inert.
