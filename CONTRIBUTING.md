# Contributing to Bomb Farm Companion

Thank you for your interest in contributing!

## Development setup

1. Install Node.js 22+ and pnpm 10+.
2. Clone the repository and run `pnpm install`.
3. Start the app with `pnpm dev` (Windows).

## Pull requests

- Branch from `main`; keep PRs focused.
- Ensure `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass locally.
- On Windows, run `pnpm test:smoke` when touching boot/IPC/renderer wiring.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.
- Describe which product requirement IDs your change addresses when applicable.

## Code style

- TypeScript strict — no `any` without justification.
- Match existing formatting and naming in the package you edit.
- IPC contract changes require updates to `@bombfarm/contracts` and tests.

## Community

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md).
