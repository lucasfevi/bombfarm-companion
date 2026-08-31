---
"@bombfarm/desktop": patch
---

Stop the window sticking and jumping while it is dragged, and stop the main process being blocked
for a fifth of every second while the game is running.

Finding the game is a PowerShell spawn — `Get-Process` through `powershell -NoProfile`, measured at
166ms per call on the development machine, and a cold start every time, so it does not amortise.
`runPowerShellSync`'s own doc comment already said it was "for call sites that run once per attach,
not on a recurring poll". The game reader's live tick called it directly, and that tick runs every
50ms for as long as the game is connected: the main process was spending more than three times its
own poll budget inside a child process, permanently.

Electron's main process is single-threaded, and the window's message loop is on that thread. A
frameless window being dragged is moved by that loop, so the drag froze and lurched in step with
the spawns. The offline development mode never showed it because the fixture tick never asks who is
running — which is why this survived several attempts to find it in the shell and the renderer,
where it never was.

Two changes, because the two states fail differently:

- **While the game is running**, a pid already in hand is verified with `process.kill(pid, 0)` — a
  syscall rather than a process — so the connected poll looks nothing up at all.
- **While the game is closed**, there is no pid to verify and the lookup is unavoidable, so it is
  now awaited rather than blocked on. The next poll is scheduled after the tick finishes rather
  than alongside it, so a slow lookup cannot stack ticks behind it.

Measured on the real read path, driving the same polls:

| | before | after |
| --- | --- | --- |
| main-process event-loop lag, p90 (game running) | 182 ms | 12 ms |
| main-process event-loop lag, worst (game running) | 262 ms | 14 ms |
| drag samples where the window did not move | 74.9% | 1.1% |
| catch-up jumps per drag | 12 | 1 |
| largest catch-up jump | 36 px | 3 px |
| main-thread freezes over 50 ms in 35 s (game closed) | 5, of 159–191 ms | 0 |

The synchronous way to *find* a process is gone rather than left beside the async one, so nothing
can reach for it again; `runPowerShellSync` itself stays, for the one-shot callers it was written
for. A guard reads the source and fails if either the blocking helper or a per-tick lookup returns
— the previous rule was a doc comment four lines above the call site that broke it, and the
behaviour is identical either way, so nothing observable would have caught it.

The pid is also dropped when consent is withdrawn: identifying the player's game process is one of
the things that gate covers, so the answer is not held across a revocation.
