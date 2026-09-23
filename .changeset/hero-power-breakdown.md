---
"@bombfarm/domain": minor
"@bombfarm/hero": minor
"@bombfarm/desktop": minor
---

The Heroes screen takes the game's own Power figure apart. A new panel on the Combat stage prints the hero's Power as the game shows it — written the way the game writes it, e.g. `32.41M` — scored on the same sheet the Effective Stats panel reads — active runes included, with the stored rune-free figure named beside it while a rune is on — and splits it into the factors that multiply it: crit, speed, range, luck, energy, penetration and cooldown, each with how many times it lifts Power and its share of the stack, measured from a hero with none of that statistic. Picking a factor opens Power drawn across that statistic's range with the hero's current value marked; hovering, dragging or the arrow keys move a guide that reads Power at that value and the change from now. Crit shows both the chance and the damage, the latter beside a line for crit chance at its cap; cooldown past 17.85%, the highest the formula has been checked at, is drawn dashed and labelled as extrapolated; range steps at the Wide Blast levels where the reach gains a whole cell. The formula behind it lives in `@bombfarm/domain/game-power` and reproduces the game's figure to float precision.
