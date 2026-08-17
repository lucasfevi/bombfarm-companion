# Line endings — LF everywhere

**Status:** hard truth (repo hygiene)

Every tracked text file is stored with **LF** in the git index and checked out with LF on
every platform, Windows included. There is no per-file exception and no per-platform
exception.

## Why this is a rule and not a preference

Before this was pinned, endings drifted per file: 532 tracked files were stored with CRLF,
667 with LF, and two carried both inside a single file. The cost was not aesthetic:

- An in-place stream edit (`sed -i`) on a CRLF file strips every CR, so a one-line change
  arrives as a whole-file diff. The real change is unreviewable.
- Any formatter that rewrites endings does the same thing, and takes `git blame` with it —
  every line reattributes to the reformatting commit.
- Two files with the same content and different endings compare as entirely different.

## The three surfaces

| Surface | File | What it does |
| --- | --- | --- |
| Git | [`.gitattributes`](../.gitattributes) | `* text=auto eol=lf` normalizes the index and pins the checkout; binary extensions are enumerated explicitly so auto-detection can never rewrite one |
| Editor | [`.editorconfig`](../.editorconfig) | `end_of_line = lf`, UTF-8, final newline — stops drift at the keystroke |
| Guard | [`tools/line-endings.test.mjs`](../tools/line-endings.test.mjs) | Reads `git ls-files --eol` and fails on any `i/crlf` or `i/mixed` entry |

### Where the guard runs

- **Locally:** the root `pnpm test` (Vitest, `tools` project). `pnpm test` is a local-only
  command — no workflow invokes it — so this surface catches drift only if you run it.
- **In CI:** [`.github/workflows/line-endings.yml`](../.github/workflows/line-endings.yml),
  on every pull request and on every push to `main`/`develop`. That workflow is
  **deliberately not path-filtered**, unlike every other workflow here: a line ending can
  regress from any tracked file, so narrowing it would reopen the hole it exists to close.
  Its `line-endings-required` job fails if the guard job was skipped or cancelled, not just
  if it failed.

`ci-desktop.yml` and `ci-fidelity.yml` also run the `tools` project incidentally when their
own path filters match — defence in depth, not the gate.

That "not path-filtered" property is itself pinned, by
[`tools/line-endings-workflow.test.mjs`](../tools/line-endings-workflow.test.mjs): it fails
if the workflow ever grows a `paths:`/`paths-ignore:` key or a `dorny/paths-filter` step, if
the `pull_request` trigger is narrowed, if the aggregator is swapped for the skipped-tolerant
`ci-desktop-required` idiom, or if the job stops invoking the suite. Its filename starts with
`line-endings`, so the workflow's own `--project tools line-endings` filter runs it — the
guard travels with the thing it guards.

The guard reads the **index**, not the working tree, because the index is where the drift
was stored. It allows `i/lf`, `i/-text` (binary) and `i/none` — a file with no line
terminator at all, which today is exactly `packages/domain/src/data/catalog.json` and
`phases.json`, the two minified files an emitter writes and `.editorconfig` exempts from
the final-newline rule. If git cannot be run it **fails**; it does not skip.

## Known exception: seven files still carry a UTF-8 BOM

Seven tracked source files begin with `ef bb bf` (five `apps/web/src/features/*/index.ts`
barrels plus `packages/ui/src/cn.ts` and `escape-reg-exp.ts`). `.editorconfig` sets
`charset = utf-8`, which in EditorConfig means UTF-8 **without** a BOM — `utf-8-bom` is the
separate value — so an EditorConfig-aware editor will strip those three bytes on the next
save and produce a surprise one-byte diff. Neither `.gitattributes` nor the guard covers
this: `text=auto eol=lf` normalizes terminators only, and `git ls-files --eol` reports
nothing about a BOM. Tracked in
[issue #114](https://github.com/lucasfevi/bombfarm-companion/issues/114); deliberately not
fixed here, since it is a content change rather than a line-ending one.

## Adding a binary format

`.gitattributes` enumerates binary extensions rather than trusting auto-detection. Add the
extension there before committing the first file of a new binary type, or a later
`git add --renormalize` may mangle it.

## If the guard fails

```bash
git add --renormalize .
git commit -m "chore: normalize line endings"
```

Do not repair it with an in-place stream edit — that is the failure mode this rule exists
to prevent.

## `git blame` and the normalization commit

The whole tree was normalized mechanically, which without help would make one commit the
author of every line it touched. [`.git-blame-ignore-revs`](../.git-blame-ignore-revs) is
how blame skips it. GitHub's blame view honours the file automatically. Locally, opt in
once per clone:

```bash
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

**Adding an entry is a follow-up, not part of the PR.** PRs here are squash-merged into
`develop` (see [`branching.md`](branching.md)), so a branch's own commits never land and
their SHAs are useless in this file. Only the squashed commit exists on `develop`, and its
SHA is not known until the merge — so the entry goes in afterwards.

The normalization branch was still split into three commits (`.gitattributes`, then the
reformatting alone, then the guard and docs). That split is for **review**, not for blame:
it lets a reviewer diff the reformatting commit on its own and confirm it changes nothing
but line terminators. The squash discards it.

## Related

- [`git-commits.md`](git-commits.md) — atomic commits and PR workflow
- [`AGENTS.md`](../AGENTS.md) — the `sed -i` prohibition lives under Conventions
