---
"@bombfarm/contracts": minor
"@bombfarm/desktop": minor
"@bombfarm/ui": minor
---

Fill out the Live tab's earnings panel, which showed six numbers and then a large empty space
below them wherever the map panel beside it ran taller.

Two things now sit in that space. A trend line covers the same ten minutes the headline gold rate
averages, so a run that is picking up or falling away is visible rather than something you infer
from two figures that disagree — a stretch the stream never covered breaks the line instead of
drawing it as a collapse to no income. Beneath it, three measured figures: gold per prop, props
per minute, and the session's prop count, all counted from what actually dropped. Gold per prop is
printed against the map panel's own estimate for the map being played, so a map paying less than
it should now says so.

The trend line ships as a `Sparkline` primitive in the design system rather than as a one-off:
it takes any series of readings, stretches to whatever width its container has, and takes its
colour from the text colour around it.
