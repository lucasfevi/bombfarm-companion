---
"@bombfarm/web": patch
---

The last native `title` tooltips on the web planner — the Buy-me-a-coffee link in the header, the
truncated hero name, and the abbreviated hero-strip metrics — now use the design-system Tooltip.
They are themed, honour the app's own delay, appear on touch and keyboard focus, and reveal the
full figure where the text is clipped, instead of the browser's unstyled native tip that never
showed on a phone.
