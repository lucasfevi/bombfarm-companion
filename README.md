# Bomb Farm Companion

Desktop companion and web planner for [Bomb Farm](https://store.steampowered.com/) (Steam playtest): inventory visibility, pricing helpers, hero planning, and stats — read-only local desktop plus a static web planner.

## Status

Monorepo with `@bombfarm/desktop` (Electron) and `@bombfarm/web` (Next.js static export). Shared math lives in `@bombfarm/domain`; UI primitives in `@bombfarm/ui`.

**Web hosts:** production [https://bombfarm-companion.vercel.app](https://bombfarm-companion.vercel.app) (`main`); pre-production preview [https://bombfarm-companion-git-develop-lucasfevi-projects.vercel.app](https://bombfarm-companion-git-develop-lucasfevi-projects.vercel.app) (`develop`, Vercel Authentication). DNS/redirect from the old planner host is manual and out of band.

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

Path-filtered GitHub Actions (quality only — **no** deploy workflow):

| Workflow | When |
|---|---|
| `ci-web.yml` | push to `main` / `develop` and PRs — `apps/web`, `packages/domain`, `packages/ui`, shared root configs |
| `ci-desktop.yml` | push to `main` / `develop` and PRs — `apps/desktop`, contracts/game-data/pricing/ui, shared root configs |
| `e2e-web.yml` | push to `main` / `develop` and PRs — Web Playwright smoke + visual |

**Vercel (Git integration):** production deploys from `main` to [https://bombfarm-companion.vercel.app](https://bombfarm-companion.vercel.app). Every push to `develop` updates the pre-production preview at [https://bombfarm-companion-git-develop-lucasfevi-projects.vercel.app](https://bombfarm-companion-git-develop-lucasfevi-projects.vercel.app). That preview is behind **Vercel Authentication** and is not a shareable playtester link. No Custom Environment, custom domain, or new GitHub Actions secret is involved. Framework: Next.js. **Root Directory:** `apps/web`. Branching: [`docs/branching.md`](docs/branching.md). Prefer green `ci-web` (including `pnpm --filter @bombfarm/web build`) before treating prod as healthy.

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
