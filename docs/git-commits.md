# Git commits — atomic by default

**Status:** hard truth (agent workflow)

When the user asks you to **commit** (or to land work via PR), **split changes into atomic commits** unless they explicitly ask for a single squash commit.

## Default behavior

- **One logical change per commit** — each commit should build/review cleanly on its own and have a single clear intent.
- **Commit only when asked** — do not commit proactively; when asked, default to **many small commits**, not one blob.
- **Conventional Commits** — `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:` (enforced by commitlint + husky).
- **Tests travel with the change** — add or update tests in the same commit as the behavior they cover.
- **Docs travel with the change** — if a commit changes UX or public contracts, update the owning `docs/` file in that commit (not a separate “docs dump” at the end).

## How to slice work

Good atomic units (examples):

| Commit | Includes |
| --- | --- |
| `feat: bundle wiki assets` | `public/…` assets + path helpers + `wiki-assets.test.ts` |
| `feat: add game-art components` | new components + barrel + recipe tests |
| `feat: import hero skin from save` | storage/import + compat doc + import tests |
| `refactor: neutral gear slot chrome` | slot editor + slot chrome tests only |

Avoid:

- One commit mixing unrelated areas (assets + i18n + unrelated refactor).
- “Fix review” commits that touch ten files across three features — split by intent.
- Committing without the tests that prove the commit’s claim.

## Message format (commitlint)

- **Subject:** imperative, ≤72 chars, Conventional Commits type + scope optional.
- **Body:** wrap at **100 characters** per line (`body-max-line-length`).
- **Windows / PowerShell:** heredocs often fail — use `git commit -m "subject" -m "body line 1" -m "body line 2"` or a short single-line body.

Example:

```bash
git commit -m "feat: bundle wiki assets and path helpers" \
  -m "Mirror Grimorio art under public/wiki-assets/." \
  -m "Add wiki-assets.ts URL helpers and unit tests."
```

## PR workflow (reminder)

- Branch from up-to-date `main`; never commit directly to `main`.
- Push the branch; open a PR; wait for CI green.
- A PR may contain many atomic commits — that is **preferred** over one squashed mega-commit unless the user requests squash-on-merge only.

## Related

- [`AGENTS.md`](../AGENTS.md) — Git / PR workflow index
- [`validation.md`](validation.md) — author ≠ validator (separate from commit granularity)
