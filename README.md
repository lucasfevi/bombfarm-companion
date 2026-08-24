# Bomb Farm Companion

Desktop companion and web planner for [Bomb Farm](https://store.steampowered.com/) (Steam playtest): inventory visibility, pricing helpers, hero planning, and stats — read-only local desktop plus a static web planner.

## Status

Monorepo with `@bombfarm/desktop` (Electron) and `@bombfarm/web` (Next.js static export). Shared math lives in `@bombfarm/domain`; UI primitives in `@bombfarm/ui`.

**Web hosts:** production [https://bombfarm-companion.vercel.app](https://bombfarm-companion.vercel.app) (`main`); pre-production preview [https://bombfarm-companion-git-develop-lucasfevi-projects.vercel.app](https://bombfarm-companion-git-develop-lucasfevi-projects.vercel.app) (`develop`, Vercel Authentication). DNS/redirect from the old planner host is manual and out of band.

## Requirements

- Node.js 22+
- pnpm 10+
- Windows (only supported platform for desktop v1)

## Antivirus

Your antivirus may flag or quarantine the desktop companion. The companion attaches to the running Bomb Farm client to read the data that client is already exchanging with the game's server, and attaching to another running program is the technique behavior-based detection is built to look for. The warning is about that technique, not about a virus.

The companion sends nothing of its own to the game, does not modify the game client, and has no code path that writes to your account. Attaching is disclosed before it happens and cannot start until you allow it, and you can withdraw that permission at any time.

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
| `pnpm --filter @bombfarm/desktop package:dev` | Local diagnostic installer (not distributed) |
| `pnpm --filter @bombfarm/desktop package:nightly` | Nightly-channel installer |
| `pnpm --filter @bombfarm/desktop package:beta` | Beta-channel installer |
| `pnpm --filter @bombfarm/desktop package:prod` | Production installer (`latest` channel) |

## CI / deploy

Path-filtered GitHub Actions (quality only — **no** deploy workflow):

| Workflow | When |
|---|---|
| `ci-web.yml` | push to `main` / `develop`, PRs, and manual dispatch — `apps/web`, `packages/domain`, `packages/ui`, shared root configs |
| `ci-desktop.yml` | push to `main` / `develop`, PRs, and manual dispatch — `apps/desktop`, contracts/game-data/pricing/ui, shared root configs |
| `e2e-web.yml` | push to `main` / `develop`, PRs, and manual dispatch — Web Playwright smoke + visual |
| `changesets.yml` | PRs + `develop` push — changeset validation and requirement |
| `release-pr.yml` | `develop` push — release PR rail and beta installer when desktop ships |
| `release-sync.yml` | release PR merged to `main` — version sync back to `develop` |
| `nightly.yml` | schedule + dispatch — nightly desktop prerelease |
| `release-prod.yml` | `main` push — prod desktop artifact (GitHub Release when enabled) |

Desktop installers are built by **nightly**, the **release-PR beta job**, and **release-prod** — not on every `main` push. See [`docs/releases.md`](docs/releases.md).

**Vercel (Git integration):** production deploys from `main` to [https://bombfarm-companion.vercel.app](https://bombfarm-companion.vercel.app). Every push to `develop` updates the pre-production preview at [https://bombfarm-companion-git-develop-lucasfevi-projects.vercel.app](https://bombfarm-companion-git-develop-lucasfevi-projects.vercel.app). That preview is behind **Vercel Authentication** and is not a shareable playtester link. No Custom Environment, custom domain, or new GitHub Actions secret is involved. Framework: Next.js. **Root Directory:** `apps/web`. Branching: [`docs/branching.md`](docs/branching.md). Prefer green `ci-web` (including `pnpm --filter @bombfarm/web build`) before treating prod as healthy.

## Version chrome

Both apps show their package version in persistent UI (no in-app changelog):

- **Web:** footer `data-testid="app-version"` — semver label from `apps/web/package.json` at build time.
- **Desktop:** shell version plus flavor label when not `prod` — from IPC (`app.getVersion()`).

A changesets bump updates the displayed version without extra code edits.

## Releases

Feature PRs carry changesets → merge to `develop` → an always-current release PR targets `main` → merge triggers version sync and optional desktop artifacts. Maintainer runbook: [`docs/releases.md`](docs/releases.md). Contributor changeset rules: [CONTRIBUTING.md](CONTRIBUTING.md#changesets).

## Desktop flavors

Four isolated desktop flavors share one codebase. Set `BFC_FLAVOR` to `dev`, `nightly`, `beta`, or `prod` at build/run time. When unset in an **unpackaged** local run, the app defaults to `dev`.

| Flavor | App ID | User data (`%APPDATA%`) | How obtained | Distributed |
| --- | --- | --- | --- | --- |
| `dev` | `net.bombfarm.companion.dev` | `Bomb Farm Companion (Dev)` | Local run / `package:dev` | No |
| `nightly` | `net.bombfarm.companion.nightly` | `Bomb Farm Companion (Nightly)` | Installed / `package:nightly` | Yes (`nightly` channel) |
| `beta` | `net.bombfarm.companion.beta` | `Bomb Farm Companion (Beta)` | Installed / `package:beta` | Yes (`beta` channel) |
| `prod` | `net.bombfarm.companion` | `Bomb Farm Companion` | Installed / `package:prod` | Yes (`latest` channel) |

Each flavor has its own app ID, install entry, and data directory so nightly, beta, and prod can coexist on one machine alongside a local `dev` run.

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
