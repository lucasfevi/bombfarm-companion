---
"@bombfarm/desktop": patch
---

Add a developer-only way to run the desktop smoke suite without any window reaching the screen, so
a run no longer paints over the machine or takes focus once per spec. `BFC_HIDE_WINDOWS=1`
suppresses the reveal a window performs when it is created — both the main window and the mini Live
window — and, with it, the maximize that would otherwise surface a restored maximized layout.

Only the automatic reveal is suppressed. An explicit `show()`, such as the tray's Show or a second
instance surfacing the window, is untouched. The flag is refused in a packaged build regardless of
environment, so a shipped app cannot be started with a window the player cannot find.
