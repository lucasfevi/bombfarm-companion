# Agent guide — Bomb Farm Companion (app repo)

This repository contains **application code only**. Product specs and research live in a separate private planning workspace — do not reference or link to those paths from this repo.

## Stack

- **pnpm** monorepo (`apps/desktop`, `packages/*`)
- **Electron 35+** main/preload (esbuild bundle)
- **Next.js 15** renderer (`output: 'export'` — no API routes / SSR)
- **TypeScript strict**, **Vitest**, **Playwright** (`_electron` smoke)
- **Tailwind CSS 4** + **@base-ui/react** (design system expands in M2)
- **electron-log** (main/preload/renderer)
- **SQLite** via `Storage` wrapper (`node:sqlite` when Electron's Node supports it, else `better-sqlite3`)

## Local checks (run before PR)

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm test:smoke   # Windows — builds static renderer + launches Electron
```

## Conventions

- Conventional Commits (`feat:`, `fix:`, `chore:`, …) — enforced by commitlint
- IPC types live in `@bombfarm/contracts`; both main and renderer import from there
- No Node integration in the renderer; use preload `contextBridge`
- No secrets in the repo
- Do not mention other fan tools in user-facing docs

## Flavors

`BFC_FLAVOR=dev|prod` selects app ID and isolated user-data paths (see README).
