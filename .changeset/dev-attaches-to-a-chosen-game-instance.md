---
"@bombfarm/desktop": patch
---

`pnpm dev --pid <n>` attaches the app to one instance of the game when several are running, and `pnpm dev:pids` lists them with their start times. Without a pin every lookup — the live tap, the memory reader and the keep-alive presence check — took whichever instance had launched first, and nothing said so. The pin is `BFC_GAME_PID`, read at every lookup; a value that is not a positive integer stops the launcher rather than falling back to "any instance".

`pnpm dev --sandbox <box>` starts Electron inside a Sandboxie box, for a game instance that runs boxed: the tap's agent can only reach the companion from inside the same box. Only Electron goes in — the renderer dev server stays on the host and is loaded over loopback, since a box's copy-on-write view of the tree breaks a dev server that keeps rewriting its own chunks. `Start.exe` does not pass the launcher's environment into the box, so every variable Electron needs, the pin included, is handed over explicitly.
