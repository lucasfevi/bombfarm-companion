---
"@bombfarm/desktop": minor
"@bombfarm/contracts": patch
"@bombfarm/game-api": patch
---

Settings has a new "Start with Windows" switch, on by default. The app starts when you sign in to Windows, and only while account access is allowed; turn account access off and it stops starting. If you switch the app off in Windows' own Startup settings, it stays off and the switch says so, and it also says when Windows won't let the app register. Uninstalling the app removes its startup entry.

The first time you close the window while the app keeps running in the notification area, it now tells you once that it is still running and how to quit it.

The account-access disclosure has a new line, "Keeps running in the background", so you will be asked to accept it again. Your saved settings carry over unchanged.
