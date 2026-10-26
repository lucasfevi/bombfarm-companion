---
"@bombfarm/desktop": patch
---

The desktop app's windows no longer follow a page that tries to leave the app by itself, and no longer open your browser for one: links open it only when you click them. Frames inside a window are held to the same rule, and every browser permission (notifications, location, camera, devices and the rest) is refused.
