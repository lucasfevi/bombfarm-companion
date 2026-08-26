---
"@bombfarm/desktop": minor
---

The desktop window now draws Windows' native Minimize/Maximize/Close overlay directly on top of
the app's own top bar instead of a separate OS title bar above it — the top bar is draggable, and
its brand, nav, and PT/EN toggle stay clickable. The header reserves room for the overlay buttons
at runtime, from the actual area Windows hands back, rather than a hardcoded width.
