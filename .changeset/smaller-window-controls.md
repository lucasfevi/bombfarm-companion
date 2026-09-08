---
"@bombfarm/desktop": minor
"@bombfarm/contracts": patch
"@bombfarm/ui": patch
---

Draw the window's minimize, maximize and close buttons in the header, at a third of their size.

**Smaller, because they are ours now.** The three buttons in the top-right corner were drawn by
Windows, which fixes them at 47px wide and lets an app change only their height and their colours.
They are now 28px squares drawn by the app — the same control the compact Live window already uses
for its own close — in the header's own muted ink, lifting to a soft wash under the cursor rather
than to the OS's flat grey. They keep the window's top-right corner, flush with both edges, where
the OS drew them and where a hand reaching to close a window goes.

**Close still hides to the tray.** The button asks the window to close and nothing more, so the
same rule answers it as before: with the tray running, closing hides the window and leaves the app
collecting live data behind it. Nothing here quits the app; the tray's own Quit still does.

**The middle button says which one it is.** It shows the restore mark and announces itself as
"Restore down" whenever the window is maximized, and it follows the window rather than its own
last click — snapping to an edge, double-clicking the header or pressing Win+Up all move it.

The top bar's collapse widths are unchanged, but the cluster claims 36px less room than the OS
buttons did, so the tabs and actions keep their full shape on a slightly narrower window.
