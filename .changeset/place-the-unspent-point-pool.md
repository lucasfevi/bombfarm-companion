---
"@bombfarm/domain": minor
---

Make the Optimizer spend the stat points a hero has not placed yet, instead of only reshuffling
the ones it already spent. A level-102 hero holding 52 unspent points was offered a rearrangement
of the other 50 and nothing else — the points it had banked were never mentioned, never priced,
and never appeared in the plan at all.

The gold search had no move that could place them. Every move in its per-hero neighbourhood is a
transfer, so a vector's total never changes; five of its six seeds ARE built from the hero's whole
level pool, but each is a squad-wide assignment at one shared energy share, so it wins or loses
for every hero at once. The sixth carries each hero's current total. That left one route to a
banked point — a squad-wide re-split good enough to beat the incumbent on every other hero's
account too — which a large pool sometimes tipped and a small one never did. On a roster already
settled at the optimizer's own advice, banks of 1 to 12 points were dropped in full; on the
account that surfaced this, a bank of 52 was dropped as well. The damage objective was unaffected:
its seeds are built per hero, so a full-pool seed can win on its own merit.

The per-hero neighbourhood now carries a family that places unplaced points, whole pool first so
one accepted move settles it and the transfer family spreads it from there. Placement still has to
earn its keep against the objective — more damage can clear a phase faster than the field refills
and cost gold — so a point that buys nothing stays where it is rather than being spent for the
sake of it. The level ceiling is untouched: no proposal has ever been allowed to exceed it, and
none does now.
