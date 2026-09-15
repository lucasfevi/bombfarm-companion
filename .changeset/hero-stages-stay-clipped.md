---
"@bombfarm/ui": patch
"@bombfarm/web": patch
"@bombfarm/desktop": patch
---

The Heroes screen no longer shows a horizontal scrollbar under the roster and the hero's stages.

The four stages sit side by side in one strip with the inactive ones held off screen, and an
`sr-only` caption on the Gear stage's totals table — being absolutely positioned, with nothing in
the strip positioned above it — was measured against the scrolling region rather than the strip,
so the region grew a scrollbar for content nobody could see. Every hero with equipment showed it.
The strip's stage boxes are now positioned, so the clip reaches everything inside them.
