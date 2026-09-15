---
"@bombfarm/web": minor
"@bombfarm/desktop": minor
---

The roster board now has a card-detail control, each card carries the hero's sheet, and each
card leads with the hero's power.

**The sheet, on the card.** Under the birth-roll bars — now headed "Birth stats" — a card prints
the hero's own eight stats as the game does: attack, energy, speed, luck, crit chance, crit
damage, penetration and cooldown, each with its exact figure on a tooltip. The bars say where
each stat landed inside its band; the figures say what it is. Bars and figures are labelled with
the same three-letter codes, the same in either language — `ATK`, `ENE`, `SPD`, `LCK`, `CrC`,
`CrD`, `PEN`, `CDR` — so crit chance, crit damage and cooldown no longer share a label, and
hovering any of them still shows the full name in your language.

**Three presets, on the board's own header.** Full is what the board opens on: identity, birth
stats, sheet stats, ability pool and gear. Combat is the same card with the gear left off — the
pool and the sheet are what a fighter is; the gear it happens to be wearing is not. Compact cuts
a card to its identity, its power, its roll bars in a single line and its ability pool as a row of
small icons without their level badges, with no headings at all — which is what puts a whole
roster of twenty on one screen. Nothing is lost to a screen reader in any of them: every bar,
figure and icon keeps its full name and its exact reading on its tooltip.

The control sits on the board rather than in the toolbar above it, because the toolbar governs
the list as well and the list has no detail to set. It is a way of looking at the board you are
in front of, not a setting about your account, and it opens on Full every time.

**Power is the figure.** A card used to print the birth roll's mean as its headline number, with
power in small type beneath it. The mean of eight percentiles said less than the eight bars right
under it already did, so it is gone — the bars are the roll — and power, the figure the game
itself sums a hero up with, takes the headline in the card's corner, labelled as such. Still
compact, the way gold is: `617.210` reads `617.2k`.
