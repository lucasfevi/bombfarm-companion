---
"@bombfarm/desktop": patch
---

Stopping `pnpm dev --sandbox <box>` now closes the Electron it started inside the Sandboxie box. Ctrl+C on the launcher only ever reached the `Start.exe` it had spawned, and that process is not the boxed app's parent — Sandboxie hands the program to a second `Start.exe` of its own — so the boxed companion kept running and tapping the game after its renderer server was gone. Shutdown now asks Sandboxie which pids are in the box and terminates the Electron ones from the host; the game and Steam, which share the box, are left alone.
