# Farm cadence: the blast term does not decay with prop density

**Status: measured, not yet fixed.** `packages/domain/src/farm-rate.ts` ships a known throughput
error. This records what it is, what it is not, and the evidence — so the next attempt starts from
the measurements rather than from scratch.

## Confirmed game mechanics

Owner-confirmed and, where marked, measured off gameplay video. Everything below had previously
been assumed; two of the assumptions were wrong, and one of those was blocking the model for days.

| | |
| --- | --- |
| Grid | **19 × 16 = 304 tiles**, MEASURED off two visually different worlds (36.25 × 35.25 px cells, identical). |
| Map size vs ato | **Constant.** Every ato uses the same grid and packs more props into it. |
| Blast shape | **Cross** — up/down/left/right only, no diagonals. |
| Blast reach | **1 tile** base, **3 tiles** with Explosão Ampla. Matches `blastRange` in the model. |
| Blast propagation | Passes **through** props; everything in reach is destroyed. |
| Bomb placement | On a tile **orthogonally touching the target prop**, never at range. |
| Bombs per hero | **One at a time.** The serial `max(fuse, hop/speed)` cycle shape is correct. |
| Global bomb cap | None beyond one-per-hero, so at most `fieldSlots` bombs live at once. |
| Prop layout | **Uniform random** scatter. Not clustered, not a fixed per-map pattern. |
| Respawn | None. The prop count falls monotonically to zero. |
| Targeting | Heroes choose **independently and collide**; a hero whose target dies re-targets immediately. |

**`blocksPerBomb` is geometry, not a fitted coefficient.** With the above, the expected props
destroyed by one bomb when `p` props remain on `T` tiles is

```
blocksEffective(p, r) = 1 + (crossCells(r) − 1) × (p − 1) / (T − 1)
crossCells(r) = average in-bounds cross cells = 3.770 at r=1, 10.618 at r=3
```

At ato 1's starting density that gives **1.448** (r=1) and **2.555** (r=3) against the shipped
constants **1.50** and **2.50** — derived to within 3%, from geometry alone. The shipped numbers
are this expression frozen at ato-1 start.

## The within-clear decay, measured on three solo runs

Kill rate against props remaining, pooled from ~1s telemetry over 432 maps. Solo runs only, so
there is no collision waste and no adjacency cap — whatever bends these curves is a single hero's
own cadence. Each hero normalised to its own full-map rate.

| props left | hero A (reach 1) | hero B (reach 1) | hero C (reach 3) | spread |
| --- | --- | --- | --- | --- |
| 40 | 0.983 | 0.985 | 0.928 | 6% |
| 30 | 0.878 | 0.951 | 0.743 | 24% |
| 20 | 0.763 | 0.773 | 0.766 | **1.3%** |
| 10 | 0.554 | 0.560 | 0.546 | **2.7%** |
| 5 | 0.501 | 0.571 | 0.351 | 47% |
| 3 | 0.522 | 0.565 | 0.279 | 63% |

**From a full map down to ~10 props the decay is the same for every hero regardless of blast
reach.** All three lose about 45%. Pure blast-density geometry cannot produce that: it predicts
reach 1 loses only 25% by p=10 and reach 3 loses 50%. The reach-1 heroes fall twice as far as
their blast term allows.

**Blast reach only separates the curves in the last handful of props.** Below p≈5 the reach-3 hero
collapses to 0.28–0.35 while the reach-1 heroes hold 0.50–0.57 — a wide blast being wasted on
isolated props, which is the effect this document opens with. It is real, it is large where it
applies, and it applies to roughly the last 10% of a clear.

**So the dominant within-clear term is reach-independent, and travel is the only candidate left.**
Nearest-prop distance grows as `sqrt(T/p)`: 2.5 cells at a full ato-1 map, 5.5 at ten props left,
7.8 at five. The cycle is `max(fuse, hop/speed)`, so a hero is fuse-bound early and walk-bound
late. Sketching that against hero A: walk alone predicts 0.69 at p=10, blast alone 0.75, together
0.51 — against 0.55 measured. Neither term alone gets close; together they bracket it.

**The model holds hop length FIXED for a whole clear.** `hopScaleForAto` picks one hop
distribution per ato, i.e. it assumes prop density is constant from the first bomb to the last,
when in fact density sweeps from 50 (or 75) down to zero every single map. That is the missing
integral, and it is a bigger term than the blast decay that this document was named after.

**What did NOT work.** Counting bombs directly off gameplay video: explosion sprites fragment into
several bright blobs and overlap continuously when many heroes are active, so blob counts were
unusable (a 72s clip yielded an impossible 0.22 props per bomb). The prop-count side of the video
worked but covers only three partial maps — the telemetry above is the same measurement with
100× the sample.

## The defect in one line

`blocksPerBomb = 1 + 0.5 × blastRange` is computed once and applied to the **entire clear**, but a
bomb's blast only strikes several props while props are still clustered. As the map empties the
advantage shrinks toward one prop per bomb, and it shrinks *further the wider the blast is*.

Because the credit never decays, the board **over-predicts** rosters carrying Explosão Ampla and
**under-predicts** rosters without it. Those are opposite signs, which is why no scalar correction
can fix it.

## What was measured

Three solo runs, each a single hero **one-shotting every prop** (`E[HTK]` exactly 1), House slack,
field contention 0. Under those conditions the run measures `plantsPerSec × blocksPerBomb × EFF_IA`
and nothing else — no damage model, no concurrency model, no deployment-order assumption.

Ratio is measured ÷ predicted throughput; above 1 means the board under-predicts.

| hero | blast | walk cells | clears | ratio | board reads |
| --- | --- | --- | --- | --- | --- |
| A | 1.50 | 2.116 | 311 (13.1h) | 1.112 | 11.2% LOW |
| B | 1.50 | 1.939 | 35 (3.3h) | 1.147 | 14.7% LOW |
| C | 2.50 | 1.911 | 74 (3.1h) | 0.904 | 9.6% HIGH |

On outlier-robust medians: 12.4% low, 12.6% low, 8.4% high.

**Hero B is the discriminator.** It carries hero C's walk speed with hero A's blast, and it behaves
like A. Speed is not the error; the blast term is.

## The mechanism, measured directly

Instantaneous kill rate against how much of the map is still standing, from ~1s-resolution
remaining-prop counts:

| | 100–80% | 80–60% | 60–40% | 40–20% | 20–0% | endgame / mid |
| --- | --- | --- | --- | --- | --- | --- |
| A (blast 1.50) | 100 | 86.7 | 65.0 | 61.9 | 52.0 | **66.7%** |
| B (blast 1.50) | 100 | 81.3 | 68.4 | 59.1 | 52.0 | **64.0%** |
| C (blast 2.50) | 100 | 90.0 | 81.8 | 71.1 | 35.5 | **40.7%** |

The two blast-1.50 heroes trace the same curve — same 52.0% endpoint — despite a 9% walk-speed gap.
The blast-2.50 hero holds up better mid-map and then collapses far harder. Blast changes the
curve's *shape*; speed does not.

This is a second, independent confirmation: the averages and the shapes agree.

## Two effects, and their sizes

1. **Blast decay with density — dominant.** Endgame retention 66.7% / 64.0% at blast 1.50 against
   40.7% at blast 2.50. A wide blast is *worse* than a narrow one once only isolated props remain.
2. **Inter-hero congestion — measured directly, and it is not secondary.** At map end heroes
   contend for bomb placement and can be locked out when others occupy every tile around the last
   prop. Present in the model as nothing at all. See the next section.

## Congestion, measured on a fixed map

A multi-hero run at ato 1 — five heroes all one-shotting, House slack (demand 1.99 of 5 slots),
field cap inert (2.4 of 9) — holds map size fixed and varies only how many heroes share it. Over
242 clears in 3.05h the rotation walks the whole range from one hero to five, so a single run
yields the curve rather than one pooled number.

Throughput is compared against the model's *conditional* expectation given exactly `n` heroes up,
so a bin is never charged for merely containing different heroes than another bin.

| heroes on map | clears | measured ÷ model | normalised to n=1 | lost to crowding |
| --- | --- | --- | --- | --- |
| 1 | 27 | 1.098 | 1.000 | — |
| 2 | 60 | 0.995 | 0.907 | **9.4%** |
| 3 | 91 | 0.913 | 0.831 | **16.9%** |
| 4 | 67 | 0.878 | 0.800 | **20.0%** |
| 5 | 23 | 0.839 | 0.765 | **23.5%** |

One parameter fits it to within 3.2%, in heroes-per-prop `d`:

```
g(d) = 1 / (1 + 4.15 × (d − 0.02))
```

**The rotation half of the model is exact.** Measured occupancy 2.388 against the board's 2.392,
an error of 0.2%, and 8.039 against 8.075 (0.4%) on the other account. Nothing in the House or
uptime path needs attention; the entire remaining error is per-hero cadence.

**In the regime players actually farm, that error is small.** Per hero on the field the board
reads **7.7% high** on the crowded ato-1 run and **5.1% high** on the crowded ato-2 account. The
larger figures elsewhere in this document come from *solo* runs, which no real roster resembles.

## What has already been tried and failed

- **Scalar refit.** Dead on arrival: the two accounts miss in opposite directions.
- **Linear blast recalibration.** Fitting `blocksPerBomb = a + b × rangeCells` on two heroes gives
  `1.668 + 0.297 × range`. Applied to a **held-out** account it made the prediction *worse* —
  12.4% over becomes 14.3% over. Two points fitting two parameters has zero degrees of freedom.
  The base is not wrong (both blast-1.50 heroes read ~12% low, consistently); what is wrong is that
  the credit does not decay. Raising the base pushes the blast-heavy account further up.

- **Two-parameter density model.** `ratio(b) = alpha x (1 + (b-1) x gamma) / b`, where `alpha`
  scales the plant rate and `gamma` is the share of the blast bonus that actually lands over a
  whole clear. Fitted on all three solo anchors (one degree of freedom left over) it lands
  `alpha = 1.392`, `gamma = 0.416`, with residuals of **+0.8% / -2.3% / 0.0%** — it explains the
  ato-1 solo data well. Applied to the **held-out** multi-hero ato-2 anchor it again made things
  worse: 12.4% over becomes 14.8% over. Fits the fit set, does not transfer.

- **Crowding term from the ato-1 curve above.** Applying `g(d)` to a held-out account made the
  aggregate worse — 10.6% mean absolute error becomes 16.2%. The reason is instructive rather
  than fatal: `g` is normalised so that a lone hero scores 1.0, but a lone hero is exactly where
  the board reads ~10% LOW. Applying the crowding cut without the solo lift double-counts.
  The two terms have opposite signs and comparable size, which is why every attempt so far that
  moved one of them alone has made a real roster worse.

Do not retry any of these without new identifying data.

## What DID transfer: the shape

Run the same per-bin comparison on the held-out account at ato 2 and normalise each account to its
own least-crowded bin. Over `d` from 0.080 to 0.120 the ato-1 curve predicts a fall to **0.883**.
The held-out account measured **0.882**.

That is the crowding law transferring across accounts, atos, roster sizes (5 against 15) and prop
counts (50 against 75), with no refitting. It is the first component of this model that has ever
survived a held-out test.

What still does not transfer is the *level* — the `alpha` intercept. `g` says how throughput falls
as a map gets crowded; it says nothing about where that curve starts.

## The intercept is not a function of blast

With `g` measured, crowding can be divided out of a multi-hero window and `alpha` read off
directly. If `alpha` were the blast-decay term this document opens with, it should agree between
two rosters of near-identical blast mix. It does not:

| window | blast mix | crowding `g_eff` | implied `alpha` | E[HTK] |
| --- | --- | --- | --- | --- |
| ato 1, 5 heroes, one-shot | 1.810 | 0.869 | **1.039** | 1.000 |
| ato 2, 15 heroes | 1.926 | 0.725 | **1.306** | 2.068 |

**20.5% apart on a 6% difference in blast mix.** Blast cannot carry that. Predicting the second
window from the solo anchors' `alpha(blast)` line misses by **−20.9%**, which is worse than
shipping no correction at all.

**The live hypothesis is that `alpha` tracks `E[HTK]`, not blast.** The blast penalty exists
because blast is *wasted* on empty space near the last props. When a prop takes two hits, a wide
blast that fails to kill still *damages* — the overspill is collected later rather than thrown
away, so the penalty should shrink as `E[HTK]` rises. That is the direction observed, and it is
the only account of both windows that does not require blast to do something it cannot.

## Four anchors, and what the intercept actually tracks

Per-hero cadence with occupancy divided out, so only the cadence term is being compared. `alpha`
is what remains after the measured crowding law `g` is also divided out.

| acct | phase | ato | E[HTK] | clears | hours | occupancy | density | board per hero | **alpha** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | 19 | 1 | 1.00 | 242 | 3.0 | 2.39 | 0.048 | +7.7% | **1.069** |
| 2 | 49 | 1 | 1.80 | 461 | 9.5 | 2.43 | 0.049 | −0.6% | **1.158** |
| 1 | 61 | 2 | 1.69 | 1116 | 8.7 | 8.58 | 0.114 | +9.1% | **1.309** |
| 1 | 71 | 2 | 2.07 | 169 | 1.7 | 8.04 | 0.107 | +5.1% | **1.312** |

Every one of these is stable across its own duration — the two long runs drift 0.9% between first
and second half over 9h.

**The E[HTK] hypothesis is half right and cannot be the main term.** Within the ato-1 account
`alpha` does rise with `E[HTK]` (slope 0.112 per unit). Within the ato-2 account it is **flat** —
1.309 to 1.312 across `E[HTK]` 1.69 → 2.07, a slope of 0.008. A term that explains one account and
vanishes on the other is not the explanation.

**The dominant term is the ~0.15–0.24 gap between the two atos**, and it is larger than anything
`E[HTK]` does. Note also that the two ato-2 anchors agree to **0.2%** with each other despite
different phases, roster sizes and days — so whatever sets the level is stable and worth finding.

**`g`'s slope is right; its level extrapolates badly.** The earlier held-out check validated the
*shape* over d 0.08→0.12 (predicted 0.883, measured 0.882) — but that comparison normalised each
account to its own least-crowded bin, so it never tested the level. `alpha` absorbing +0.15 at ato
2 is `g` over-correcting once extrapolated past the range it was fitted on (0.02–0.10).

The likely reason is that heroes-per-*prop* is the wrong density. Heroes-per-*area* is the physical
quantity, and an ato-2 map carries 1.5× the props but an unknown multiple of the area. If the area
grows faster than the prop count, ato-2 maps are less crowded than `d` implies, which is exactly
the direction needed.

## RESOLVED: crowding is set by hero count, not heroes-per-prop

The crowding law above was normalised by heroes **per prop**, on my own unchecked assumption that a
higher ato meant a bigger map. It does not — owner-confirmed, every ato packs its props onto the
same grid, which `hopScaleForAto` already states. On a fixed grid the density variable is simply
the **hero count**, and re-deriving on that axis collapses the ato gap that the two sections below
were written to explain.

Fitting one `alpha` and one `g(n)` jointly against the absolute per-bin rates of all three
multi-hero runs — two accounts, two atos, hero counts 1 through 9, ~1,700 clears:

```
per-hero rate = board × alpha × g(n)
alpha = 1.179
g(n)  = 1 / (1 + 0.140 × (n − 1) ^ 0.380)
```

**Weighted rms 1.84%.** Letting `alpha` differ per ato improves it to 1.81% and moves `alpha` by
2% — i.e. the per-ato term buys nothing and there is no ato-specific behaviour left to explain.

| | n=1 | n=2 | n=3 | n=4 | n=5 | n=6 | n=7 | n=8 | n=9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `g(n)` | 1.000 | 0.877 | 0.846 | 0.825 | 0.808 | 0.795 | 0.783 | 0.773 | 0.764 |

Whole-window accuracy against the shipped board:

| run | measured props/hr | shipped | with the model |
| --- | --- | --- | --- |
| ato 1, 5 heroes | 2,437 | −2.3% | **−0.8%** |
| ato 2, 16 heroes | 9,655 | +14.4% | **+2.9%** |
| ato 2, 15 heroes | 7,323 | +5.6% | **−4.1%** |

Mean absolute error **7.4% → 2.6%**.

**NOT YET HELD OUT.** All three runs are in the fit. Account and ato are still aliased in the fit
set (ato 1 only on the second account, ato 2 only on the main one), so the honest test is the one
named below — the second account at ato 2, a combination no fitted run covers. Do not ship before
that returns.

## The held-out test this now needs: ato and account are still aliased

Every ato-1 anchor is the second account. Every ato-2 anchor is the main account. Nothing in the
table above can separate "ato 2 behaves differently" from "the main account behaves differently".

The second account reaches ato 2 at phase 51 and its five-hero pool clears the whole 51–66 band, so
the confound is breakable on the account that is available for experiments. **Phase 51 is the
single-variable run**: `E[HTK]` 1.861 against phase 49's 1.800 — near-identical — same account,
same five heroes, same uptimes, ato 1 → 2 the only change. `alpha` near 1.31 means the level is a
property of the ato; near 1.16 means it is a property of the account, and the two would then need
separating some other way.

## Superseded: the run that was to decide it

Same account, same five heroes, same 50-prop ato-1 map, same rotation — `E[HTK]` is the only
variable moved. Uptimes are unchanged to three decimals (2.392 against the earlier run's 2.393),
so crowding density is not merely comparable but identical.

| | earlier run | this run |
| --- | --- | --- |
| phase | 19 | **49** |
| E[HTK] | 1.000 | **1.800** |
| board clear | 42.0s | 75.6s |
| board props/hr | 4,286 | 2,381 |
| board gold/hr | 1.18M | 1.88M |

**It ran, and the answer was neither.** `alpha` came in at **1.158** against 1.069 at `E[HTK]` 1.0
— a real move, in the predicted direction, but far short of the 1.30 the ato-2 account shows. The
follow-up 9h ato-2 anchor then found `alpha` flat in `E[HTK]`, which is what demoted this from
"the mechanism" to "a second-order term". See the four-anchor table above.

**Caveat on the second held-out window.** A phase-51 window read 0.815 rather than 0.883, but its
occupancy also missed by 7.5% (measured 7.96 against a modelled 7.37), which means the roster in
its save is not the roster that ran — the failure mode
[never-fit-formulas-to-one-account] warns about. The phase-71 window used above matched occupancy
to 0.4% and is the trustworthy one. Do not average the two.

## SUPERSEDED — the per-ato hop-length reading

Holding `gamma` at its fitted value and solving `alpha` separately per ato:

| | alpha needed |
| --- | --- |
| ato 1 (three solo anchors) | **1.392** |
| ato 2 (multi-hero anchor) | **1.212** |

Both exceed 1 — the shipped plant rate is too slow in both regimes — and **ato 2 needs less
correction than ato 1**. That is the signature of a hop-length term rather than a flat multiplier:
a denser map means shorter hops, more plants land fuse-bound, and the cycle model has less room to
be wrong.

Read on a single hero with a 1.909s fuse:

```
model cycle  3.005s   => 1.096s of walk + latency stacked on top of the fuse
implied      2.159s   => 0.250s
```

So the shipped per-bomb overhead is roughly **0.85s too generous at ato 1**. A quarter-second of
plant-to-plant overhead is a believable figure; 1.1s is not.

**SUPERSEDED — this whole section was the confound, not the answer.** It flagged its own caveat:
the one ato-2 anchor was also the only multi-hero one, so `alpha(ato 2)` and congestion could not
be separated. Congestion has since been measured directly, and it accounts for the gap; the
per-ato `alpha` split was crowding wearing a hop-length costume. There is no evidence for a
per-ato hop term, and the 0.85s "too generous" per-bomb overhead below is an artefact of
attributing crowding loss to the cycle model. Kept as a record of the dead end — do not act on it.

## The geometry, simulated — and one correction

A sequential simulation of a whole clear on the real 19x16 grid (304 tiles), hero walking to the
nearest prop, bomb placed on an adjacent tile, cross blast passing through props. Both mechanics
are owner-confirmed; the grid is fixed at every ato, so only the prop count changes.

**CORRECTION to an earlier claim in this document's history: `blocksPerBomb` 1.50 and 2.50 are NOT
derived geometry.** Simulated on the real grid at a full ato-1 map they come out at **1.22**
(reach 1) and **2.24** (reach 3); nothing reproduces 1.50, and 2.50 sits between reach 3 and
reach 4. `1 + 0.5 x blastRange` is a heuristic, not a derivation, and it was asserted here as
derived without being checked.

What the simulation does show is the shape the model is missing — both terms move a long way
inside a single clear:

| props left | blocks, reach 1 | hop, reach 1 | blocks, reach 3 | hop, reach 3 |
| --- | --- | --- | --- | --- |
| 50 | 1.218 | 0.62 | 2.241 | 0.69 |
| 30 | 1.105 | 2.03 | 1.612 | 2.64 |
| 10 | 1.074 | 2.88 | 1.480 | 3.39 |
| 3 | 1.047 | 4.14 | 1.261 | 4.83 |
| 1 | 1.000 | 6.17 | 1.000 | 7.18 |

Averaged over a whole clear that is **1.10** blocks at reach 1 and **1.58** at reach 3 — against
the 1.50 and 2.50 the model applies throughout. The shipped constants are roughly the FULL-MAP
values, held for the entire clear.

## Does the integral reproduce the measured curves? Partly.

`rate(p) = blocks(p) / max(fuse, hop(p)/walkSpeed)`, with the simulated terms and each hero's own
sheet values. Nothing fitted. Scored against the measured within-clear decay:

| | mean absolute error |
| --- | --- |
| shipped model (both terms constant) | **53%** hero A, **100%** hero C |
| simulated geometry, nothing fitted | **33%** |
| same, with hop doubled | 20% |

So the integral is the right direction and takes a large bite out of a very large error — but 33%
unfitted is not shippable, and the hop-doubling that improves it is a free parameter, which is
exactly what the acceptance bar below forbids.

**The gap is hop, and it is not small.** A greedy nearest-prop hero walks 2.35 cells per plant
averaged over a clear; the capture behind the shipped `HOP_DISTRIBUTION` measured **4.77**. Some of
that is contention (that capture is multi-hero, this simulation is solo), but the residual says the
real pathing is materially worse than greedy-nearest, and by how much is not derivable. `EFF_IA`
takes a flat 10% for imperfect AI, which is an order of magnitude short of covering it at low
density.

**What would close it: hop(p) measured, not modelled.** Plant-to-plant distance as a function of
props remaining. Explosion centroids in gameplay video mark plant locations, so consecutive plants
give hops directly — but attributing plants to heroes needs a SOLO clip. One hero, an ato-1 phase
it one-shots, two or three minutes, whole grid in frame. That single measurement removes the last
free parameter from the integral.

## What the fix has to look like

```
now:  clearSecs = propCount / propsPerSec              // one rate, constant blast
need: clearSecs = ∫ dp / rate(p, blast, speed)         // blast decays toward 1 as p falls
```

Physically motivated shape: `blocksEffective(f) = 1 + (blocksNominal − 1) × g(f)`, with `f` the
fraction of the map still standing, `g(1) = 1` and `g(0) = 0` — a bomb next to the last prop can
only ever kill that one prop. A walk term rides on top: hops lengthen as props thin out, which is
why even the blast-1.50 heroes lose ~35% by the endgame.

## Acceptance bar for any attempt

1. **Held out before shipped.** Fit on the solo curves, then test against an account and an ato
   that were not in the fit. The linear attempt above passed its fit and failed exactly here.
2. **Two accounts, different regimes.** See [never-fit-formulas-to-one-account]; one account with
   the House slack and one where it binds.
3. **Direction and magnitude per account**, not a single pooled ratio — a consistent sign across
   regimes is the evidence, one number is not.
4. **Ground truth must not assume automation.** Deployment and House prioritisation are automation
   configuration, not game behaviour; a model fitted to them read ~12% off once that assumption was
   dropped. Solo one-shot runs are immune by construction, which is why all three anchors are solo.

## Open, not yet measured

- **Whether the intercept belongs to the ato or to the account.** THE blocker — the two are
  perfectly aliased across all four anchors. Phase 51 on the second account breaks it.
- **Map area per ato.** The suspected reason `g` mis-levels: heroes-per-prop is a proxy for
  heroes-per-area, and the two diverge if map area and prop count scale differently. Not in any
  capture so far.
- Blast is ruled out as the intercept (20.5% spread on a 6% blast difference). `E[HTK]` is real
  but second-order (slope 0.112 at ato 1, 0.008 at ato 2).
- **A third blast value**, if `E[HTK]` turns out not to explain it. Only 1.50 and 2.50 appear in
  any crowd-free anchor, so a blast-shaped `alpha` would have two points and zero degrees of
  freedom — the trap that killed the linear recalibration above. Needs a solo one-shot run by a
  hero whose blast is neither; the available second account has no such hero today.
- **Whether `alpha` can be derived instead of fitted.** Blast decay and crowding are plausibly the
  same physics seen twice — one is prop density falling *within* a clear, the other hero density
  across the map. `g(d)` is now measured. If the within-clear prop-density curve (already captured,
  the retention table above) reproduces `alpha`, no further capture is needed at all. Untried.
- **Congestion beyond d = 0.12.** The fit spans 0.02–0.10 and the held-out check reaches 0.12.
  A roster denser than that is extrapolation.

  Two items previously listed here are now closed. Ato/map-size scaling: the crowding law
  transfers between 50 and 75 props unchanged, so map size needs no separate term. Congestion as
  a function of occupancy: measured, five points, one parameter, 3.2% residuals.
