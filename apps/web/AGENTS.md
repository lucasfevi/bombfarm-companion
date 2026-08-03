# Agent guide — `@bombfarm/web`

Thin index for the static Next planner. Shared monorepo rules: root [`AGENTS.md`](../../AGENTS.md) + [`docs/`](../../docs/README.md). Web-only hard truths: [`docs/`](./docs/README.md).

## Stack

- Next.js 15 App Router, `output: 'export'`
- React 19 + React Compiler
- Zustand (no `zustand/persist`) — see `docs/state-management.md`
- `@bombfarm/domain` + `@bombfarm/ui` via `workspace:*`

## Local checks

```bash
pnpm --filter @bombfarm/web typecheck
pnpm --filter @bombfarm/web test
pnpm --filter @bombfarm/web build
pnpm --filter @bombfarm/web test:e2e:smoke
```
