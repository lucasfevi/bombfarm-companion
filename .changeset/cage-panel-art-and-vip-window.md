---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Reworks the Phases explorer's Cage panel and corrects its stale VIP guarantee window.

The section header drops the "(hero clock)" / "(relógio de herói)" suffix down to just "Cage" /
"Jaula", and the panel now shows the bundled cage art centered under the title, with a short
description underneath explaining how the cage's early-arrival chance works — replacing a tooltip
that only lived on the early-arrival row's label. That row is reworded to "Early-arrival chance at
this phase" now that the explanation moved into the panel description rather than a hover.

The Guarantee window row now shows the VIP window (3h) as muted subtext under the normal window
(3h 30m), sourced from `PhaseIntelGlobal.jaulaWindowVipSecs`, a new field wired straight off
`JAULA.janelaSecsVip` alongside the existing `jaulaWindowSecs`.

**The committed wiki bundle's VIP window was stale.** `phase-wiki.json`'s `janelaSecsVip` read
9900 (2h45m); the live wiki reports 10800 (3h). Corrected as a targeted key fix, not a full
re-sync — every other bundled value and the bundle's sync timestamps are untouched.
