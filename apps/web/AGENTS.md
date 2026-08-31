# Agent guide — `@bombfarm/web`

Thin index for the static Next planner. Shared monorepo rules: root [`AGENTS.md`](../../AGENTS.md) + [`docs/`](../../docs/README.md). Web-only hard truths: [`docs/`](./docs/README.md).

## Stack

- Next.js 15 App Router, `output: 'export'`
- React 19 + React Compiler
- Zustand (no `zustand/persist`) — see `docs/state-management.md`
- `@bombfarm/domain` + `@bombfarm/ui` via `workspace:*`

## RULE: the download page draws the desktop Live screen — keep the drawing current

`/download` shows a **replica** of the desktop app's Live tab
(`src/features/download/components/live/`). It shares no code with the real screen and
it cannot: the boundaries forbid importing from `apps/desktop`, and the desktop speaks its own
bilingual copy layer ([`docs/i18n.md`](../../docs/i18n.md)). So it is a second implementation of a
screen that already exists, and second implementations rot quietly — the page keeps rendering, no
test goes red on its own, and one day it advertises a product that no longer looks like that.

**If you change the desktop's Live screen — a panel added, removed, reordered, relabelled, or a
figure's meaning changed — open the replica in the same change and make it match.** That is not
optional politeness: the page is marketing, and a stale drawing is a false claim about the product.

Three things hold it together. Two are mechanical, one is you:

| | What it catches | Where |
| --- | --- | --- |
| Label mirror | A mirrored label renamed or reworded in the desktop shell | `tools/download-page-drift.test.mjs` |
| Component pin | A Live component added, removed, or renamed | same file, `LIVE_COMPONENTS` |
| **Layout** | **Anything rearranged, re-grouped, or re-emphasised** | **nothing — this rule is all there is** |

The mirrored labels live in `src/features/download/model/live-replica-copy.ts`, keyed by the
desktop copy key each one mirrors. **Do not rename those keys to read better** — the key is what
the guard resolves against the desktop's copy module.

When the component pin fails, the fix order matters: **update the replica first, then re-pin
`LIVE_COMPONENTS` in the same commit.** Re-pinning alone turns the guard green over a drawing
nobody looked at, which is the one move that defeats the whole arrangement.

The page writes **no** version, filename or size down — it resolves the newest published beta from
GitHub at runtime and falls back to the releases page. Do not reintroduce a hardcoded one: the
first version of this page did, all three constants were wrong within a day, and the download
button 404'd.

## Local checks

```bash
pnpm --filter @bombfarm/web typecheck
pnpm --filter @bombfarm/web test
pnpm --filter @bombfarm/web build
pnpm --filter @bombfarm/web test:e2e:smoke
```

```bash
npx vitest run --project tools download-page-drift
```
