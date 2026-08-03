# Bomb Farm Companion

Desktop companion and web planner for [Bomb Farm](https://store.steampowered.com/) (Steam playtest): inventory visibility, pricing helpers, hero planning, and stats — read-only local desktop plus a static web planner.

## Status

Monorepo with `@bombfarm/desktop` (Electron) and `@bombfarm/web` (Next.js static export). Shared math lives in `@bombfarm/domain`; UI primitives in `@bombfarm/ui`.

**Web production host (intended):** [https://bombfarm-companion.vercel.app](https://bombfarm-companion.vercel.app) — new Vercel project on this repo, Root Directory `apps/web`, production branch `main`. DNS/redirect from the old planner host is manual and out of band.

## Requirements

- Node.js 22+
- pnpm 10+
- Windows (only supported platform for desktop v1)

## Quick start

```bash
pnpm install
pnpm dev          # desktop shell
pnpm dev:web      # web planner only
```

| Script | Purpose |
|---|---|
| `pnpm typecheck` | TypeScript check (all packages) |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests |
| `pnpm test:smoke` | Playwright Electron app-boot smoke test |
| `pnpm --filter @bombfarm/web build` | Web static export |
| `pnpm --filter @bombfarm/desktop package:dev` | DEV installer |
| `pnpm --filter @bombfarm/desktop package:prod` | PROD installer |

## CI / deploy

Path-filtered GitHub Actions:

| Workflow | When |
|---|---|
| `ci-web.yml` | `apps/web`, `packages/domain`, `packages/ui`, shared root configs |
| `ci-desktop.yml` | `apps/desktop`, contracts/game-data/pricing/ui, shared root configs |
| `e2e-web.yml` | Web Playwright smoke + visual |
| `deploy-web.yml` | `main` + web paths → Vercel CLI production deploy |

**Vercel (human setup):** create a **new** project linked to `bombfarm-companion` (do not retarget the old hero-planner project). Framework: Next.js. **Root Directory:** `apps/web`. Production branch: `main`. Add repo secrets (never commit values):

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Prefer landing `ci-web` (including `pnpm --filter @bombfarm/web build`) before pointing the project at `main`.

## DEV vs PROD flavors (desktop)

| Flavor | App ID | User data |
|---|---|---|
| PROD | `net.bombfarm.companion` | `%APPDATA%/Bomb Farm Companion` |
| DEV | `net.bombfarm.companion.dev` | separate `-dev` data directory |

Set `BFC_FLAVOR=dev` or `BFC_FLAVOR=prod` at build/run time (defaults to PROD).

## Repository layout

```
apps/desktop/       Electron main, preload, renderer
apps/web/           Next.js static web planner (+ vercel.json)
packages/domain/    Shared planner math + phase wiki data
packages/ui/        Design-system + AppShell
packages/contracts/ IPC + shared types
packages/game-data/ Catalog client
packages/pricing/   Pricing pipeline
docs/               Shared hard truths
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). By participating, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Report vulnerabilities privately — see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
