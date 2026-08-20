---
"@bombfarm/domain": patch
"@bombfarm/web": patch
"@bombfarm/ui": patch
---

Reworks the Farm Respec Advisor's metric tile row.

The Gold/hr and Chests/hr tiles now carry the game's own coin and chest icons beside their
labels, and each one's `current → proposed` value carries its own signed percent change alongside
it (e.g. "171,081 → 180,075 (+5.3%)") — `@bombfarm/domain` exposes this as two new signed fields,
`goldGainPct` and `chestsGainPct`, on `FarmRespecResult`. Unlike the existing `gainPct` (the
active objective's value, clamped `>= 0`), these two are deliberately unclamped: whichever
currency is not being optimized can legitimately fall, and a clamped-to-zero percent would
contradict the tile's own "gives up N gold/hr for this objective" note sitting right next to it.

A new "Phase" tile sits between the rate tiles and the cost/payback tiles, showing the recommended
phase to farm before and after the proposed respec (`Easy 3-7 (#27) → Normal 1-1 (#51)`), so the
phase change driving the gold/chest numbers is visible without leaving the panel. When the
proposal does not move the phase, the tile shows the phase once plus a small "(same phase)" note
instead of printing the identical label twice. The tile row now spans 2/3/5 columns at
mobile/tablet/desktop widths to fit the fifth tile.

The Payback tile's label is now itself the tooltip trigger (a dotted underline, matching
`@bombfarm/ui`'s existing `StatList` glossary-term idiom) explaining what the figure actually
divides — the respec cost by the *increase* in gold/hr the new build earns, not the new rate on
its own — after players misread "pays for itself in 0.3 h" as computed against the new gold/hr
alone. `@bombfarm/ui` exports its existing `TipLabel` primitive from the barrel for this.

`@bombfarm/domain` also adds `chestIconSrc()` next to the existing `goldIconSrc()`, sourcing the
same sprite `dropIconSrc('chest', ato)` already used for the neutral, difficulty-independent
item-chest icon.
