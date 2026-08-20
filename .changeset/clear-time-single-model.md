---
'@bombfarm/domain': patch
'@bombfarm/web': patch
---

Fix the Farm page printing two different clear times for the same phase

The squad panel's "Est. clear time" and the ranking board's "Clear time" column were two
independent models rendered side by side. The panel divided total map HP by the squad's summed
sustained DPS, which credits the overkill a killing blow wastes; the board charges whole hits per
prop (`ceil(propHp / avgHit)`) and adds the gate boss. On the phase-51 anchor roster the panel
read 52.6s against the board's 83.8s and a measured 85.9s — 39% fast.

The panel now reads the board's own row for the selected phase, so both surfaces print one
number. `estimateClearSeconds` is removed from `@bombfarm/domain/phase-intel`; it had no other
caller. The panel's tooltip is rewritten to describe the model that now backs it.
