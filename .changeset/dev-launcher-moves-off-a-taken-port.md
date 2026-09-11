---
'@bombfarm/desktop': patch
---

`pnpm dev` no longer opens the Electron shell on another session's dev server. The launcher's free-port check bound the loopback address, which succeeds on Windows while another process — a web planner session, say — holds the same port on the wildcard address; Next then fell back a port on its own and Electron loaded whatever was on the first. The check now asks whether anything answers on the port, the way Electron will, and moves the renderer up to the next free port instead of stopping.
