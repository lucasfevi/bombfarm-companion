---
"@bombfarm/desktop": patch
"@bombfarm/ui": patch
---

A screen taller than the window now ends as far above the status strip as it starts below the header. Scrolled to the bottom, the last panel on Farm, Heroes, Account, Forge and Settings sat on the strip's border; the shell's content measure was pinned to the window's height, and a taller screen overflowed it past the padding that draws the gap.
