---
"@bombfarm/ui": patch
"@bombfarm/desktop": patch
"@bombfarm/web": patch
---

**A table's row headings now read as content rather than as headings.** The base stylesheet
dressed every `<th>` as a column heading — 10px, uppercase, letter-spaced, muted, over a full
hairline — including the ones that name a row rather than a column. Beside a cell at the table's
12px body type that put two line heights in one row, which is what tilted the Forge item panel's
stat figures off their labels. Only the headings that sit over a column get that type now; a row
heading is drawn like the cells it belongs to.

It moves the item name in both apps' bags, the stat names in every gain/loss table on the team
plan and the farm respec card, the Forge item panel's stat names, the Forge run ledger's *When*
column and the running tally's rung column. Tables that already spelled out their own heading
type — the planner's gear totals row — are unchanged.
