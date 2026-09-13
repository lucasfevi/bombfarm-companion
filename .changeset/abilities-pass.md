---
"@bombfarm/domain": minor
"@bombfarm/hero": minor
"@bombfarm/web": minor
"@bombfarm/desktop": minor
---

Model three more combat abilities — Breach, Pack and Baton Pass — and price every team aura
one way on every screen.

**Breach is the fifth standing team aura.** It reads as flat penetration points on every hero on
the field, +1 per level, capped at 20 across every carrier — the same shape as Deadly Omen's crit
points. It sits beside the other four everywhere they are enumerated: the Combat tab's and the
Heroes screen's aura switches gain a fifth row, the Farm board and the Optimizer weight each
carrier by its predicted uptime, and a hero's own screen always counts its own rank. The
penetration breakdown shows it as its own team line.

**Pack is an own ability priced at the field size.** Each level adds +0.5% damage per ally
standing beside the carrier, capped at +90% (live wiki, 2026-09-13 — the catalog's old
"+2% / +40%" text matched neither). A hero's own screen counts the heroes the game has deployed
beside it; the Farm board and both Optimizer objectives count each other hero for its own share
of the rotation, never more than the field has room for. The damage formula prints the pack
factor as its own term with a glossary tip.

**Baton Pass is the sixth team aura, and comes in pulses.** When a carrier enters the rotation the
whole field — heroes without the ability included — deals +4% damage per rank for 120 seconds.
The Farm board, the Farm respec advisor and both Optimizer objectives price it as the other
auras are priced: each carrier's pulse lights the field for its own share of wall clock,
overlapping pulses sum their ranks and clamp at +80% inside the expectation, and the Farm board
prices every hero's hit through its own hits-to-kill step at each pulse level, so the credit
lands only where a pulse crosses a threshold. A hero's own screen now prices its OWN pulse from
the same rule, at its own stint length, so the ability's next level reads as a real gain there
too; the other carriers' pulses are counted only on the rotating surfaces, and the Effective
stats tip says so. On the calibration anchor, one rank-20 carrier moved gold per hour by about
+1%, re-pinned and not refitted.

**The abilities panel prices the three.** Breach reports a gain below its ceiling and names the
ceiling at it, Pack reports a gain beside allies, Baton Pass reports a gain — and Ghost, Hero
Hunter, Gold Vein, Fortune and Lapidary Eye still read "not modelled".

**The wiki-drift capture was a month stale.** The committed capture the drift tooling's tests
read still carried Mercy at 1.25% per level and Keen Eye at 0.75% from 2026-08-14; it is
re-taken from the live endpoint and pinned to the committed fingerprint baseline, so it cannot
silently lag the catalog again.
