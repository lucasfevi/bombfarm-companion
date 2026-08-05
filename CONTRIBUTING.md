# Contributing to Bomb Farm Companion

Thank you for your interest in contributing!

## Development setup

1. Install Node.js 22+ and pnpm 10+.
2. Clone the repository and run `pnpm install`.
3. Desktop: `pnpm dev` (Windows). Web planner: `pnpm dev:web`.

## Pull requests

- Branch from an up-to-date `develop` and open the PR against `develop`. See [`docs/branching.md`](docs/branching.md) — `main` is release-only.
- Ensure `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass locally.
- Web changes: also run `pnpm --filter @bombfarm/web build` (CI runs this before Vercel).
- On Windows, run `pnpm test:smoke` when touching boot/IPC/renderer wiring.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.
- Describe which product requirement IDs your change addresses when applicable.

CI is **path-filtered**: web-only PRs run `ci-web` / `e2e-web`; desktop-only PRs run `ci-desktop` (Windows package job on `main` push). Changes under `packages/ui` wake both.

## Web deploy (maintainers)

**Production** ([https://bombfarm-companion.vercel.app](https://bombfarm-companion.vercel.app)): Vercel Git integration on this repo, Root Directory `apps/web`, production branch `main`.

**Pre-production preview:** every push to `develop` deploys a Vercel branch preview — host and access model are in [`docs/branching.md`](docs/branching.md). Access is gated by **Vercel Authentication** (owner-only today; not a shareable playtester link).

GitHub Actions runs path-filtered CI only — there is no Actions deploy workflow and no Vercel deploy secrets in GitHub. Old planner host redirect is manual later.

## Code style

- TypeScript strict at the monorepo base — see [`docs/typescript-planner-origin.md`](docs/typescript-planner-origin.md) for the documented planner-origin package exception.
- Match existing formatting and naming in the package you edit.
- IPC contract changes require updates to `@bombfarm/contracts` and tests.
- Never add a `.specs/` directory to this repository.

## Community

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md).
