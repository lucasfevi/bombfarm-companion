---
'@bombfarm/domain': minor
'@bombfarm/web': minor
---

Farm Ranking: price team auras over the rotation, and refit the per-ato hop density law

The board's gold/hr ran high, and two independent terms were responsible.

**Team auras were read off the deployed line-up.** `account.teamBuffs` is a snapshot of whoever is
standing on the field at the instant a save is exported — the right quantity for the advisor and
the team-plan scorer, which price one fixed line-up, and the wrong one for a board that cycles a
whole pool through the House for hours. A carrier on the field 59% of the time had its full aura
applied to 100% of every row; a carrier sitting in the pool but not deployed contributed nothing at
all, even though it farms for a large share of every hour. The Farm Ranking board now derives the
four combat auras from the enabled pool's own ability ranks weighted by each hero's uptime, so
toggling a carrier out of the rotation pool correctly removes its aura too. Multiple carriers of
the same aura are combined as an expectation over independent presence rather than as a capped sum,
which stops two half-present carriers reading as one permanently present one. An explicit team-buff
override still reaches the board verbatim — a hand-typed "assume this much aura" has no carriers
behind it to weight.

**Hop length was assumed to fall as the inverse square root of prop density.** A denser ato does put
its props closer together, but not nearly as strongly as that geometry predicts. Refitting the
density response against 632 attributed plant-to-plant hops gives an exponent of 0.124 (bootstrap
95% CI [0.066, 0.158]), where 0.5 was being used; ato 2's plants sit 0.951x as far apart as ato 1's,
not 0.816x. This was shortening modelled ato-2 clears by about 5%.

Against 192 live clears of phase 51 the board's gold/hr moves from ~11.7% high to within 0.4%, and
on a second, earlier capture of the same account the residual falls from -6.2% to +3.9%. Every
per-hero and per-phase throughput figure the board prints moves, as do the Farm respec solver's
proposals, which read the same rates.
