# Agent guide — Bomb Farm Companion (app repo)

This repository contains **application code only**. Do not invent planning/spec directory trees here.

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
  `packages/domain/src/data/phase-wiki.json` — maintainers refresh that file out of
  band). **No wiki HTTP client in shipped app code.** One scheduled CI job,
  `.github/workflows/wiki-drift.yml`, fetches the wiki to detect drift; it is
  alert-only and may not write `packages/domain/**` — see
  [`docs/wiki-drift-check.md`](docs/wiki-drift-check.md)
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
- **Never use `sed -i` (or any in-place stream edit) on a tracked file.** Use the editing
  tools instead, which preserve existing endings. Do not convert a file's endings as a side
  effect of a change — the repo is LF everywhere (`.gitattributes`), and a stream edit that
  rewrites endings turns a one-line change into a whole-file diff that buries the real change
  and destroys `git blame`. See [`docs/line-endings.md`](docs/line-endings.md)
- No secrets in the repo
- Do not mention other fan tools in user-facing docs
- **Changesets are mandatory** on any PR touching `@bombfarm/web` or `@bombfarm/domain` user-visible
  behavior — the `Require a changeset` CI check fails the PR otherwise, it does not just warn. Add
  one in the same commit as the code change: `pnpm changeset`, or hand-write
  `.changeset/<slug>.md` (see [`.changeset/README.md`](.changeset/README.md) for the frontmatter
  format). Internal-only changes (CI config, tests, docs) don't need one; if a changeset genuinely
  doesn't apply, label the PR `skip-changeset` instead of skipping silently.

## Out-of-scope findings — file a GitHub issue

Work here routinely turns up a real defect that should **not** be fixed in the current change:
a neighbouring code path with the same bug, a shared invariant with no owner, a stale doc.
Those findings are worth more than the session they were found in.

**File a GitHub issue for them. Do not leave them in a chat message, a task chip, or a `TODO`
comment** — all three die with the session, and the finding then gets rediscovered from scratch
weeks later as if it were new.

```bash
gh issue create --title "<imperative summary>" --label tech-debt --body "<what, where, evidence>"
```

- **File when** the fix would widen the current PR's scope, needs its own changeset, touches a
  package the current change does not, or would mix a refactor into a bugfix.
- **Fix inline instead when** it is a one-line change inside code you are already editing.
- **The issue must stand alone.** Include the file paths and line numbers, the evidence that it
  is real (the grep, the failing case, the call path), and why it was not fixed now. Someone
  picking it up months later has none of the conversation it came from.
- **Link both ways**: reference the issue from the PR that found it, so the trail survives.
- Verify before filing. A claim that a neighbouring path "was checked and is fine" needs the
  same evidence as a claim that it is broken — one pasted grep is usually enough.

## Flavors

`BFC_FLAVOR` selects one of `dev`, `nightly`, `beta`, or `prod`. Unpackaged local runs default to `dev` when unset. Invalid tokens fail fast (never fall back to `prod`).

| Flavor | App ID | User data (`%APPDATA%`) | How obtained | Distributed |
| --- | --- | --- | --- | --- |
| `dev` | `net.bombfarm.companion.dev` | `Bomb Farm Companion (Dev)` | Local run / `package:dev` | No |
| `nightly` | `net.bombfarm.companion.nightly` | `Bomb Farm Companion (Nightly)` | Installed / `package:nightly` | Yes (`nightly` channel) |
| `beta` | `net.bombfarm.companion.beta` | `Bomb Farm Companion (Beta)` | Installed / `package:beta` | Yes (`beta` channel) |
| `prod` | `net.bombfarm.companion` | `Bomb Farm Companion` | Installed / `package:prod` | Yes (`latest` channel) |
