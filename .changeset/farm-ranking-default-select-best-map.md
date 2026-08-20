---
"@bombfarm/web": patch
---

The Farm page now opens on your current best gold/hr map instead of phase 1 — the worst map on
the board. The ranking board and the phase panels below it move together, so everything on the
page describes the same map. Once you pick a phase yourself, on the board or in the phase picker,
that choice sticks and is never overridden; the automatic pick only applies while nothing has
been chosen yet, and re-evaluates on every load so it keeps tracking your best map as your
account grows.
