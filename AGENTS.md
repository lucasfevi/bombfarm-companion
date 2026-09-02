# Agent guide — Bomb Farm Companion (app repo)

This repository contains **application code only**. Do not invent planning/spec directory trees here.

## Hard truths

| Scope | Index |
| --- | --- |
| Shared (desktop + web + packages) | [`docs/README.md`](docs/README.md) |
| Web planner only | [`apps/web/docs/README.md`](apps/web/docs/README.md) |

**The desktop Live screen is drawn a second time on the web download page.** Change one and you
change the other, in the same PR — see [`apps/desktop/AGENTS.md`](apps/desktop/AGENTS.md) and
[`apps/web/AGENTS.md`](apps/web/AGENTS.md).

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
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @bombfarm/domain test
pnpm --filter @bombfarm/web test
pnpm test:smoke   # Windows — builds static renderer + launches Electron
```

## Running the desktop app without the game

```bash
pnpm dev:offline
```

Fixture account, replayed live capture, no game process and no server needed — see
[`docs/offline-dev-mode.md`](docs/offline-dev-mode.md) for what it covers, what it cannot show,
and how it runs beside a real install. Plain `pnpm dev` is the real read path.

These commands bound their own load, and share one budget with any other Bomb Farm run on the
machine — a second checkout or session running the same sequence makes both smaller rather than
letting them multiply. `node tools/cpu-budget-report.mjs` says what is running and what each run is
getting; `BFC_CPU_BUDGET` raises or lowers the total. See
[`docs/machine-load.md`](docs/machine-load.md).

`pnpm build` is not optional and has to come first: the workspace packages publish their types
and entry points from `dist/` (`packages/domain`'s `exports` map, for one, points every subpath
at `./dist/**`), so on a freshly cloned tree `pnpm typecheck`, `pnpm lint` and three of the vitest
projects — `@bombfarm/desktop`, `@bombfarm/game-api` and `tools` — all fail to resolve them until
the packages are built. All three run `tools/require-workspace-dist.mjs`, which throws and names
the unbuilt packages instead of letting the affected files die at collection: the first two as a
project-wide `globalSetup`, and `tools` as a per-file call from the single file that needs a build
(`globalSetup` would also fire in the deliberately build-free `line-endings` CI job, which runs
that project with a filename filter). `apps/web` and `packages/domain` alias `@bombfarm/domain` to
`src/` and need no build.

## Conventions

- Conventional Commits (`feat:`, `fix:`, `chore:`, …) — enforced by commitlint
- Feature work branches from and merges into `develop`; `main` is release-only — see [`docs/branching.md`](docs/branching.md)
- **Branch names are `<type>/<kebab-case-summary>`** with a commitlint type (`feat/rotation-pool-redesign`,
  `docs/comments-hard-truth`). When tooling hands you a generated name with a random suffix, rename it
  with `git branch -m <type>/<summary>` before the first push — see [`docs/branching.md`](docs/branching.md#branch-names)
- IPC types live in `@bombfarm/contracts`; both main and renderer import from there
- No Node integration in the renderer; use preload `contextBridge`
- **Reach for a design-system primitive before a native or bespoke control** — `Tooltip` (never the
  native `title` attribute, which lint rejects), `Select` / `Num`, `Switch` — see
  [`docs/design-system.md`](docs/design-system.md)
- **A row is full-width because it is wide, not because it matters.** Repeated short rows each
  claiming a width they do not use are a finding to **report to the maintainer**, not to silently
  rearrange — see [`docs/use-the-width.md`](docs/use-the-width.md)
- TypeScript strict at the monorepo base; planner-origin packages `@bombfarm/domain`
  and `@bombfarm/ui` intentionally keep a documented exception (see
  [`docs/typescript-planner-origin.md`](docs/typescript-planner-origin.md))
- **Never use `sed -i` (or any in-place stream edit) on a tracked file.** Use the editing
  tools instead, which preserve existing endings. Do not convert a file's endings as a side
  effect of a change — the repo is LF everywhere (`.gitattributes`), and a stream edit that
  rewrites endings turns a one-line change into a whole-file diff that buries the real change
  and destroys `git blame`. See [`docs/line-endings.md`](docs/line-endings.md)
- **A new workspace package with tests owes two things**: `maxWorkers: MAX_TEST_WORKERS` in its
  own `vitest.config.ts` (the root cap does not reach a standalone `pnpm --filter` run, which
  then takes one worker per core outside the machine-wide budget), and an entry in the root
  `vitest.config.ts` `projects` array (or `pnpm test` never runs it and stays green).
  `tools/vitest-worker-cap.test.mjs` fails on either omission — see
  [`docs/machine-load.md`](docs/machine-load.md)
- No secrets in the repo
- Do not mention other fan tools in user-facing docs
- **Changesets are mandatory** on any PR touching `@bombfarm/web` or `@bombfarm/domain` user-visible
  behavior — the `Require a changeset` CI check fails the PR otherwise, it does not just warn. Add
  one in the same commit as the code change: `pnpm changeset`, or hand-write
  `.changeset/<slug>.md` (see [`.changeset/README.md`](.changeset/README.md) for the frontmatter
  format). Internal-only changes (CI config, tests, docs) don't need one; if a changeset genuinely
  doesn't apply, label the PR `skip-changeset` instead of skipping silently.

## HARD RULE: no planning identifiers, no planning-doc paths

**This repository is public. The planning tree that drives it is not.** Nothing you write here may
carry a reference that only the private planning tree can resolve.

Two shapes are forbidden, in **source, tests, test names, assertion messages, comments, JSDoc,
markdown, commit messages, branch names, changesets, and PR/issue text**:

1. **Planning identifiers** — anything shaped `PREFIX-NUMBER`: `AD-036`, `AC-38`, `LFS-04`,
   `MSG-12`, `BSP-23a`, `MPV-01`, `DEC-03`, `W0-14`, `MP5 F4`, and any prefix a future feature
   invents. **The list is open-ended — do not treat any enumeration of prefixes as complete.**
2. **Paths into the planning tree** — `design.md §7.2`, `spec.md`, `tasks.md`, `validation.md`,
   `.specs/`, PRD references, and milestone or wave numbers used as citations.

**Write what it means, not what it is called.** The reasoning is welcome; the code for it is not.

| Don't write | Write |
| --- | --- |
| `// AD-036: gate on per-section usability` | `// gate on per-section usability, not the fidelity grade` |
| `describe('isUsable (AD-036)')` | `describe('isUsable')` |
| `// see design.md §7.2` | state the rule, or say nothing |
| `it('MSG-24 store failure ≠ drop')` | `it('store failure ≠ drop')` |

**Genuine external standards are fine and must not be "cleaned":** `SHA-256`, `UTF-8`, `BCP-47`,
`ISO-8601`, `RFC-*`. They share the shape and are not planning ids.

**Two deliberate exceptions.** Guard sources and their red-state fixtures must name the tokens they
forbid — `tools/`'s hygiene guards and `pre-push-guard.test.mjs`'s `feat/ACS-06` fixture are code,
not prose. Do not "clean" them; you will break the guard while appearing to tidy it.

**Why this is a hard rule and not a preference.** These identifiers reached this repo ~2,900 times
before anyone counted, and two prior leaks happened *despite* an explicit instruction in the
authoring prompt. Once a PR exists, GitHub pins its history at `refs/pull/N/head` and a force-push
hides the leak without removing it. **Scrub before opening the PR, not after.**

Before pushing:

```bash
git grep -nIP "\b(?!SHA-|UTF-|BCP-|ISO-|RFC-)[A-Z][A-Z0-9]{1,6}-[0-9]{1,3}[a-z]?\b" -- apps packages tools
```

## Comments

**Hard truth: [`docs/comments.md`](docs/comments.md).** Read it before adding one.

Write almost no comments. **Code and tests are the documentation** — a well-named function with
well-named variables says what it does, and behaviour you want to explain belongs in a test with a
sentence for a name, where it is proven and fails when it stops being true. A comment restating
the next line is a second copy of the logic that nothing keeps in sync.

**Wanting to comment is a finding about the code, not a documentation need.** Treat it like a
300-line function: the fix is to extract a named function, name an intermediate value, or split
the file. Reach for prose only once you have established that decomposition is not the fix.

Two shapes earn a comment, and both explain *why*, never *what*:

- **Inherent complexity that no decomposition removes** — a bitwise trick, a tight numerical
  routine, an algorithm whose correctness argument is invisible in its steps.
- **Business logic the code cannot show** — a game-balance constant and where its value came from,
  a workaround for an external quirk, a non-obvious invariant the surrounding code depends on.

**Clean up the file you touch.** A comment-heavy file you open is in scope: delete the narration,
keep the few that earn their place. Don't turn it into a whole-file rewrite of code you aren't
otherwise changing — that buries the real diff. Deliberately no lint rule enforces this; no
threshold can tell a constant's provenance from noise, so review carries it.

## Out-of-scope findings — ask before you file

Work here routinely turns up a real defect outside the current change: a neighbouring code path
with the same bug, a shared invariant with no owner, a stale doc. Those findings are worth more
than the session they were found in, and **whether they belong in the current PR is the
maintainer's call, not the agent's** — an agent filing an issue unilaterally often defers
something that was three lines from code already being touched.

**So: verify it, then ask. Do not decide alone, and do not leave it in a chat aside, a task chip,
or a `TODO` comment** — all three die with the session, and the finding gets rediscovered from
scratch weeks later as if it were new.

### The decision brief

Present each finding as a short brief and stop for an answer. **Concise and concrete — three or
four sentences per heading, with a real example rather than a description of one.** A brief that
takes longer to read than the fix takes to make has failed.

- **What and where** — the symptom, the file and line, and the evidence it is real (the grep,
  the failing case, the call path). One pasted witness, not a paragraph of reasoning.
- **Why it matters** — the concrete consequence, ideally a number or a user-visible symptom.
  "`xpPerHour` reads ~36% low on a 1.56× account, so the Farm board and the Phases panel print
  different XP for the same phase" beats "XP handling is inconsistent".
- **What fixing it takes** — the actual blast radius: files, packages, whether a fixture must be
  re-captured, whether it needs its own changeset. Say if it is genuinely small; say if you are
  unsure how far it reaches.
- **Cost of waiting** — what gets worse. Two surfaces drifting apart, a guard that silently stops
  guarding, a capture that expires. If nothing gets worse, say that plainly — "no decay, purely
  cosmetic" is a useful answer and makes deferring easy.

Then ask directly: fold it into this change, or file it? Batch several findings into one question
rather than interrupting per finding.

### After the call

- **Fold in** → do it in the same PR, and say in the PR body why the scope widened.
- **File** → open the issue and reference it from the PR that found it, so the trail survives.

```bash
gh issue create --title "<imperative summary>" --label tech-debt --body "<what, where, evidence>"
```

A filed issue **must stand alone**: file paths, line numbers, the evidence, and why it was not
fixed now. Whoever picks it up months later has none of the conversation it came from.

**Two exceptions to asking.** Fix inline without asking when it is a one-line change inside code
you are already editing. File without asking when the finding is unrelated to the current work
and needs no judgement about scope — a broken guard in a package this change never touches.

Verify before either. A claim that a neighbouring path "was checked and is fine" needs the same
evidence as a claim that it is broken.

## Flavors

`BFC_FLAVOR` selects one of `dev`, `beta`, or `prod`. Unpackaged local runs default to `dev` when unset. Invalid tokens fail fast (never fall back to `prod`).

| Flavor | App ID | User data (`%APPDATA%`) | How obtained | Distributed |
| --- | --- | --- | --- | --- |
| `dev` | `net.bombfarm.companion.dev` | `Bomb Farm Companion (Dev)` | Local run / `package:dev` | No |
| `beta` | `net.bombfarm.companion.beta` | `Bomb Farm Companion (Beta)` | Installed / `package:beta` | Yes (`beta` channel) |
| `prod` | `net.bombfarm.companion` | `Bomb Farm Companion` | Installed / `package:prod` | Yes (`latest` channel) |
