# Machine load — one CPU budget, divided among the runs actually running

**Hard truth.** Every parallel tool here is capped, and every one of those caps bounds a single
run. The machine is bounded by [`tools/cpu-budget.mjs`](../tools/cpu-budget.mjs), which divides
one budget among the runs currently executing — including runs started from a different
checkout, a different terminal, or a different agent session.

## Why the per-run caps were not enough

Each tool defaults to roughly one worker per core, so each was given a ceiling:

| Surface | Ceiling for one run | Where |
| --- | --- | --- |
| Vitest workers | 3 | [`vitest.workers.ts`](../vitest.workers.ts) |
| `pnpm -r` workspaces | 2 | [`.npmrc`](../.npmrc) |
| Next export pool | 4 | [`apps/web/next.config.ts`](../apps/web/next.config.ts) |
| Playwright web e2e | 4 local, 2 CI | [`apps/web/playwright.config.ts`](../apps/web/playwright.config.ts) |
| Playwright desktop smoke | 1 | [`apps/desktop/playwright.config.ts`](../apps/desktop/playwright.config.ts) |

Nothing coordinated between processes, so the ceilings multiplied. Four checkouts running the
local-checks sequence at once each took the full column above — and `pnpm -r typecheck` and
`pnpm -r lint` multiply memory, not just CPU, because `projectService: true` gives every
concurrent `eslint` its own TypeScript program alongside every concurrent `tsc --noEmit`.

Lowering the ceilings was the wrong fix: it taxes the single run, which is the common case, to
bound the rare one. The denominator is what needed to change.

## The mechanism

A run about to fan out writes a lease into a machine-wide directory, counts the live leases, and
takes `budget / liveLeases`, never above its own ceiling and never below 1.

```
budget 8, 1 run  -> vitest 3, next 4, workspaces 2   (unchanged from having the machine alone)
budget 8, 2 runs -> vitest 3, next 4, workspaces 2   (4 each, still above every ceiling)
budget 8, 4 runs -> vitest 2, next 2, workspaces 1
budget 8, 8 runs -> vitest 1, next 1, workspaces 1
```

The budget defaults to **a third of the machine's cores** (minimum 2) — 8 of 24 — so two thirds
stay free for the browser, the editor, and the game.

**No run ever waits.** A run arriving late gets a smaller share, not a queue position. There is no
lock to strand, so a killed run cannot block the next one.

**Leases are reaped by liveness.** Ctrl-C leaves a lease behind; the next reader drops it because
the pid is gone. A six-hour staleness backstop covers the one case liveness cannot see, the OS
recycling a dead run's pid onto a live process.

**Every failure fails open**, back to the per-run ceiling: an unwritable temp directory, a torn
lease file, a pid check that throws. Shrinking a run is an optimisation, and an optimisation that
can break the build is not worth having.

## Seeing what is running

```bash
node tools/cpu-budget.mjs
```

```
budget        8 of 24 cores
lease dir     C:\Users\...\Temp\bombfarm-companion-cpu-leases
sharing       on
active runs   3
share per run 2
  pid 11636 — vitest (41s)
  pid 25556 — next:build (12s)
  pid 31656 — workspace:-r lint (3s)
```

Reading the state claims nothing, so asking what is running never changes what is running.

## Knobs

| Variable | Effect |
| --- | --- |
| `BFC_CPU_BUDGET` | Total cores all Bomb Farm work may hold. Raise it on a machine dedicated to this work, lower it while doing something else that matters more. |
| `BFC_CPU_LEASE_DIR` | Where leases live. Tests point this at a temp directory; there is no reason to set it by hand. |
| `BFC_CPU_LEASE` | Set automatically for child processes. Its presence means "this process is part of a run that already has a share" — which is how a build nested inside a build, and Playwright and Vitest re-loading their config inside every worker, avoid counting one run several times. |

```bash
BFC_CPU_BUDGET=16 pnpm test
```

## What this does not cover

- **The share is chosen once, at startup.** Vitest, Playwright and Next all fix their pool before
  the first test or page, so a running job cannot be resized. Two runs starting in the same second
  can therefore each see a machine emptier than it is about to be and overshoot; the steady state
  is correct, the first few seconds may not be.
- **`pnpm -r` typed by hand stops at `.npmrc`.** Only `pnpm build`, `pnpm typecheck` and
  `pnpm lint` go through [`tools/with-cpu-budget.mjs`](../tools/with-cpu-budget.mjs). That is why
  the static ceiling has to stay conservative on its own — the wrapper reads it back from
  `.npmrc` rather than keeping a second copy.
- **CI is bypassed entirely.** A runner is single-tenant, with nobody to share with, so every
  caller keeps the ceiling it computed. CI behaviour is unchanged by all of this.
- **Nothing here bounds a tool that was never capped.** A new parallel tool needs its own ceiling
  passed through `cappedWorkers(cap, kind)`; the budget divides ceilings, it does not invent them.
