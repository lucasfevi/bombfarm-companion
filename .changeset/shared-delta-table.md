---
"@bombfarm/ui": minor
"@bombfarm/web": patch
---

Adds a shared `DeltaTable` primitive (`@bombfarm/ui`) — a Stat / Now / Target / Change ledger
rendered as a real `<table>` — and moves the Team Plan hero breakdowns and the Farm Respec
Advisor's per-hero card onto it, replacing two implementations that had drifted apart.

The Farm Respec hero card picks up the fixes the Team Plan grid already had: digits now align
(`tabular-nums`), the Change column is coloured by sign, and the columns hold a fixed width down
every row via `table-layout: fixed` plus an explicit `<colgroup>` — so the Luck row's "kept"
indicator (now a compact lock glyph with a tooltip, replacing a Chip + `HelpTip` pair) can no
longer widen the label column or grow its own row taller than the rest. The card's columns are
also reordered to match Team Plan's chronological now → target → change (previously target-first),
and its blank label-column header now reads "Stat". `DeltaTable` computes the change column itself
from `now`/`target` rather than accepting it as a separate input, so the two can never disagree
again.
