---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Olho Clínico and Presságio Mortal grant flat Crit POINTS, not a share of the hero's roll.

The 2026-08-23 balance patch restated both abilities in points — +40 and +20 at rank 20 — and the
wiki's per-level entries moved with it. They were modelled as percentages of the bearer's own
crit-chance roll, which is now wrong in both magnitude and shape: on a 5.08-roll hero, rank 20 used
to add 4.36 crit points and now adds 40.

A live capture pins all three parts of the new shape at once. One hero holds Olho Clínico at rank
13, wears nothing and has spent no crit-chance points, so its exported crit chance is exactly
`roll + 13 × 2 + roll × crit_chance_add` — which says the ability's contribution is flat, that the
skill tree still reads the pre-ability roll, and that the addend sits outside the shared pool.
Two geared rank-20 heroes add the gear leg: both solve to exactly zero spent crit-chance points
under that reading, and to fractional negatives if the +40 rides inside the pool. Percent-of-base
fits none of the three. Across the whole 13-hero roster every hero now solves to a whole-number
point vector with no inference issues and a budget landing exactly on its level.

Presságio Mortal's field cap moves with it, from 114.29% of base to a flat 20 points, and the
team-buff field is now labelled in points.

The crit-chance stat POINT is untouched and remains a percentage of the roll — this patch moved the
two abilities, not the point.

Alongside it, four values were resynced against the live wiki:

- Hero attack rolls for Épico, Lendária and Mítico (300–400, 500–600, 1000–1200), and — not in the
  patch note, but confirmed by both the wiki and a save's own `stat_ranges` — Rare attack and five
  of the six energy ranges, which had drifted at some earlier patch.
- The skill-stone chest on X-10 phases, from 0.005% to 0.05%.
- The time chest, from 0.15% to 0.1%.
- A ninth hero skin, so a hero wearing it imports with its own avatar instead of an "unknown skin"
  warning and a placeholder.

Olho de Lapidador's description now says what the patch clarified: the upgraded drop belongs to the
hero that destroyed the object, and Cages are excluded. Its rate is unchanged and it stays
unmodelled.

Any hero carrying either crit-chance ability sees a materially higher crit rate, and everything
downstream of it moves: the Stats panel's crit-chance ledger, next-point ranking (crit damage is
worth more the more often it lands), DPS, and the Farm board's throughput.
