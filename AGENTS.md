# Agent guide — Bomb Farm Companion (app repo)

This repository contains **application code only**. Product specs and research live in a separate private planning workspace — do not reference or link to those paths from this repo.

## Hard truths

| Scope | Index |
| --- | --- |
| Shared (desktop + web + packages) | [`docs/README.md`](docs/README.md) |
| Web planner only | [`apps/web/docs/README.md`](apps/web/docs/README.md) |

## Stack

- **pnpm** monorepo (`apps/desktop`, `apps/web`, `packages/*`)
- **Electron 35+** main/preload (esbuild bundle) — `@bombfarm/desktop`
- **Next.js 15** static web planner — `@bombfarm/web` (`output: 'export'`)
- **TypeScript strict**, **Vitest**, **Playwright** (desktop `_electron` smoke; web e2e)
- **Tailwind CSS 4** + **@base-ui/react** — design system in `@bombfarm/ui`
- Shared math in `@bombfarm/domain` (phase/economy wiki rows ship as committed
  `packages/domain/src/data/phase-wiki.json` — refresh via the private research
  wiki-sync pipeline; this repo has no wiki HTTP client)
- **electron-log** (main/preload/renderer)
- **SQLite** via `Storage` wrapper (`node:sqlite` when Electron's Node supports it, else `better-sqlite3`)

## Local checks (run before PR)

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @bombfarm/domain test
pnpm --filter @bombfarm/web test
pnpm test:smoke   # Windows — builds static renderer + launches Electron
```

## Conventions

- Conventional Commits (`feat:`, `fix:`, `chore:`, …) — enforced by commitlint
- Feature work branches from and merges into `develop`; `main` is release-only — see [`docs/branching.md`](docs/branching.md)
- IPC types live in `@bombfarm/contracts`; both main and renderer import from there
- No Node integration in the renderer; use preload `contextBridge`
- TypeScript strict at the monorepo base; planner-origin packages `@bombfarm/domain`
  and `@bombfarm/ui` intentionally keep a documented exception (see
  [`docs/typescript-planner-origin.md`](docs/typescript-planner-origin.md))
- No secrets in the repo
- Do not mention other fan tools in user-facing docs
- Never add private TLC spec directories to this repository

## Flavors

`BFC_FLAVOR` selects one of `dev`, `nightly`, `beta`, or `prod`. Unpackaged local runs default to `dev` when unset. Invalid tokens fail fast (never fall back to `prod`).

| Flavor | App ID | User data (`%APPDATA%`) | How obtained | Distributed |
| --- | --- | --- | --- | --- |
| `dev` | `net.bombfarm.companion.dev` | `Bomb Farm Companion (Dev)` | Local run / `package:dev` | No |
| `nightly` | `net.bombfarm.companion.nightly` | `Bomb Farm Companion (Nightly)` | Installed / `package:nightly` | Yes (`nightly` channel) |
| `beta` | `net.bombfarm.companion.beta` | `Bomb Farm Companion (Beta)` | Installed / `package:beta` | Yes (`beta` channel) |
| `prod` | `net.bombfarm.companion` | `Bomb Farm Companion` | Installed / `package:prod` | Yes (`latest` channel) |
