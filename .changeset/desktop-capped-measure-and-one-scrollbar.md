---
"@bombfarm/desktop": minor
"@bombfarm/ui": minor
---

Give the desktop a fixed measure, put the Live tab's two readings side by side at every window
size, and close the second scrollbar.

The app content now stops widening at 1440px and centres itself, so a wide monitor grows the
background instead of stretching the panels across it. Below that it fills the window as before.

On the Live tab, the gold/hr panel and the map panel sit side by side at every size the window can
be dragged to, including the smallest. They used to need a window wider than the one the app opens
at, so a fresh launch showed them stacked — the split made both columns as wide as the fixed-width
gold panel, which is far wider than the map needs. The gold panel now takes its own content width
and the map takes the rest, which is also the half that reads better with the extra room. A little
spacing came out of both panels to bring the pair inside the smallest window; nothing was removed.

The window itself can no longer scroll, so the Live tab never shows two scrollbars again. Screen
reader labels are positioned elements, and with nothing positioned above them they escaped every
attempt to clip the content: a long enough hero list pushed them past the bottom of the window and
the window grew a scrollbar of its own beside the one the content already had.
