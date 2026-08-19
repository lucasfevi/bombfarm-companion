---
"@bombfarm/ui": patch
"@bombfarm/web": patch
---

Fixes the sortable DataTable column header's hover so it fills the whole header cell instead of
a smaller inset box — most visible on headers taller than their own label, like Farm Ranking's
sprite-icon columns, where the fill used to stop partway down the cell leaving an unfilled band.

The hover is also restyled for the theme: a full-cell accent wash, the label lifting from muted
to ink, and a crisp accent rule along the cell's bottom edge as a sort affordance, gated by
`motion-safe`. Hover stays visually secondary to the active/sorted column, which still carries
its own persistent accent-colored label and direction chevron regardless of hover. The
keyboard focus ring now also spans the full cell rather than the button's own smaller box.
