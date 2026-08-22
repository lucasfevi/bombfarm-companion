---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Halve the per-star multiplier: a ★ now adds 25% of the hero's intrinsic base, not 50%.

The wiki publishes this as `gemas.mult_por_estrela`, and it reads `0.25`. The shipped constant
was `0.5`, measured in-game on 2026-07-23 — correct for that build, but a later patch compressed
the whole curve, and the same patch cut every base drop rate, rescaled the hero XP curve and the
item-stat bases, and reshaped the gem rank draw. Max stars stays 3, so a fully-starred hero's
intrinsic base goes from ×2.5 to ×1.75.

Only the magnitude moved. The scope is unchanged and still matches the 2026-07-23 measurement:
Attack, Energy, Crit %, Crit Dmg, Penetration, CDR and Luck all scale; Speed does not.

This affects any hero above ★0 — its sheet, its DPS, its farm ranking, and the gain the star
upgrade advertises. ★0 heroes are untouched, since the factor is ×1 either way.
