---
"@bombfarm/desktop": patch
---

The desktop app's windows now stay on the app when a page tries to take them somewhere else. A window that a page sends to a blank page is put back on the app, up to three times in ten seconds; past that it is left blank until you restart the app. They no longer open your browser on their own: that happens only through a link or the app itself. Frames inside a window follow the same rule, the file pickers are switched off, and every browser permission (notifications, location, camera, devices and the rest) is refused except copying to the clipboard.
