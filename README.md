# Bomb Farm Companion

Desktop companion for [Bomb Farm](https://store.steampowered.com/) (Steam playtest): inventory visibility, pricing helpers, and stats — built as a read-only local app.

## Status

**M0 scaffold** — monorepo boots Electron + Next.js static-export renderer. Game reader, catalog, pricing, and full UI land in later milestones.

## Requirements

- Node.js 22+
- pnpm 10+
- Windows (only supported platform for v1)

## Quick start

```bash
pnpm install
pnpm dev
```

`pnpm dev` builds workspace packages, compiles Electron main/preload, starts the Next.js dev server, and opens the desktop shell.

Other commands:

| Script | Purpose |
|---|---|
| `pnpm typecheck` | TypeScript strict check (all packages) |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests |
| `pnpm test:smoke` | Playwright Electron app-boot smoke test |
| `pnpm --filter @bombfarm/desktop package:dev` | DEV installer (`net.bombfarm.companion.dev`) |
| `pnpm --filter @bombfarm/desktop package:prod` | PROD installer (`net.bombfarm.companion`) |

## DEV vs PROD flavors

Two installable flavors share one codebase:

| Flavor | App ID | User data |
|---|---|---|
| PROD | `net.bombfarm.companion` | `%APPDATA%/Bomb Farm Companion` |
| DEV | `net.bombfarm.companion.dev` | separate `-dev` data directory |

Set `BFC_FLAVOR=dev` or `BFC_FLAVOR=prod` at build/run time (defaults to PROD).

## Repository layout

```
apps/desktop/       Electron main, preload, Next.js renderer
packages/contracts/ IPC + shared domain types
packages/game-data/ catalog client (stub in M0)
packages/pricing/   pricing pipeline (stub in M0)
packages/ui/        design-system shell + token placeholders
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). By participating, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Report vulnerabilities privately — see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
