# Domain coverage ratchet

**Status:** hard truth

`packages/domain` carries a committed, per-file baseline of measured test coverage, and a pull
request may not take any file below its recorded number. This is measurement, not a target: there
is no percentage anyone is asked to reach, and none is written down here or anywhere else.

**A high percentage is not a quality claim.** Coverage says a line executed, not that anything
asserted on it. A test that runs a function and checks nothing raises the number exactly as far as
a test that checks everything. Read the number as "this much code is reached by some test", never
as "this much code is verified". Tests held out of a run by a capture-regime hold execute nothing,
so they contribute nothing to it.

## What is measured

- Provider `v8`, with `experimentalAstAwareRemapping`, so statement, branch and function counts are
  real counts rather than v8's line-level approximation. The settings live in `vitest.coverage.ts`
  and are shared by the two root-level Vitest configs.
- Source: `packages/domain/src/**/*.ts`, declaration files excluded. No other package is measured.
- Four metrics per file: statements, branches, functions, lines. A metric with nothing to cover
  (total 0) counts as 100.
- **Both Vitest passes, merged.** The domain suite is two passes — the domain project and the solver
  pass (`vitest.solver.config.ts`), kept apart because a single synchronous solver test body crosses
  the worker RPC window. Coverage from one pass alone would understate everything the solver files
  reach, so both run instrumented, each writes a raw `blob` report, and Vitest's own
  `--merge-reports` combines the raw V8 data into one summary.
- Source files with no runtime code at all (type-only modules, re-export barrels) produce no report
  entry and are listed under `unmeasured` instead of being given a made-up number. The list is
  verified, not trusted: each entry is transpiled with the repository's `typescript` and must emit
  nothing but imports and re-exports, so a file with a function, constant or class cannot hide
  there.
- A file with runtime code that the report has no entry for is a **never-loaded** file. Vitest adds
  a never-loaded file at 0% by parsing its TypeScript source with a JavaScript parser and drops it
  when that fails, so a never-loaded file with any TypeScript-only syntax (types, annotations) has no
  report entry, while one written in plain JavaScript syntax shows up at 0%. That is why never-loaded
  files are tracked as allowances: each is recorded in `zeroCoverageAllowed` with a reason and no
  `files` row, so it is visible. Those entries are the work queue.
- Each pass's untested-file sweep prints a stack trace for every file it cannot parse — hundreds of
  lines of log noise, harmless. It must **not** be switched off with `--coverage.all=false`:
  measured on 2026-10-06, that dropped a recorded 0%-file from the merged report and failed the
  ratchet, because the 0% entry is produced by each pass's sweep and the merge cannot add it back.

Coverage has to run from the repository root, never `pnpm --filter @bombfarm/domain exec vitest
--coverage`: the include patterns are root-relative, because both configs that carry them have the
repository root as their root.

## Running it

```powershell
pnpm coverage:domain
```

Measures both passes, merges them, and compares against the baseline. It takes ten minutes or more
and holds the machine-wide heavy-run slot for the whole sequence (see
[`machine-load.md`](machine-load.md)), so it queues behind any other full run. CI runs it as its
own job, `domain-coverage`, inside the web workflow: instrumented runs are several times slower
than plain ones, and the two passes have to be measured together, so it cannot ride on the test
shards. A dedicated path filter keeps pull requests that cannot move domain coverage from paying
for it.

**Cost.** Measured on an idle Windows machine, the plain domain suite takes 213 s for the domain
project and 105 s for the solver pass, about 5.3 minutes (318 s) in all. Instrumented, the passes
take 345 s and 407 s, and about 740-760 s end to end (two runs: 757 s and 741 s), including the merge:
roughly 2.4 times the plain run. Instrumented timing varies by up to about 2x: local end-to-end runs on
an idle machine ranged from 741 s to 1072 s (main pass 324-653 s, solver pass 407-515 s). That is why
this is its own CI job and not part of the test shards.

**The measuring passes only measure.** Both run with unhandled errors ignored and a ten-minute per-test timeout, because the regular jobs are what gate correctness and this run only reads coverage out of the same tests. A failing test still fails the run, and the dot reporter names it in the log. The reason is the worker RPC window: under instrumentation a single file, the two-stage phase optimiser test, takes about 276 s, far past the 60 s window, and the first CI run on 2026-10-07 failed on that alone with every test passing and nothing printed, because the blob reporter that records the raw data prints nothing. The merge step needs the same unhandled-errors flag, since it replays what the solver pass recorded.

Wall-clock assertions are meaningless under instrumentation: the second CI run, on 2026-10-07, failed a full-solve ceiling at 4845 ms against 2500 ms and a forge forecast at 362 ms against 250 ms, with every other test passing. Those failures are tolerated by name, from a reviewed list in `tools/domain-coverage-core.mjs` (`INSTRUMENTATION_SENSITIVE_TEST_FILES`). Each entry must be a domain test file that really times itself with `performance.now(`, and a guard checks that, so the list cannot become a hiding place for ordinary tests. The regular jobs still run those tests uninstrumented and still gate them. Each of the three vitest commands writes JSON results outside the blob directory, and a non-zero exit is accepted only if the results parse, no suite failed outside its tests, and every failed test is in a listed file; any other failure fails the measurement and is named by file and test. When a run is accepted with tolerated failures, each is printed with its file, test name and first message line, and appended to the CI step summary, so a reviewer reading the log sees what was waived. The list works per file, so a listed file's non-timing tests are tolerated too: keep the list short. The CI job uploads the whole `coverage` directory, blobs included, so a red run can be examined.

```powershell
pnpm coverage:domain:update
```

Measures, then records improvements, new files and deleted files in
`packages/domain/coverage-baseline.json`, and prunes `unmeasured` entries that were deleted or are
now reported. It never adds a file to `unmeasured` or `zeroCoverageAllowed` by itself — those are
reviewed hand edits, and it lists the files waiting for one. The first run, with no baseline yet,
is the one exception: it records today's state, including the initial allowances. If anything regressed it refuses, names every file and
metric, and writes nothing. If nothing changed it says so and writes nothing — regenerating can
never silently re-record a lower number. The baseline diff is the review surface: one line per
file, so a diff shows exactly which file moved.

Both commands accept `--summary <path>` to read an existing `coverage-summary.json` instead of
measuring, which is how the guards in `tools/` and a reviewer can exercise the comparison without
the long run.

## What the ratchet checks

| Check | Fails when |
| --- | --- |
| Regression | any of the four metrics of any file is below its recorded value (two-decimal values) |
| Gone quiet | a recorded file that still exists produced no coverage in the measurement |
| Unrecorded file | a measured file has no `files` row |
| Unallowed zero | a file has 0 covered statements and no `zeroCoverageAllowed` entry with a reason |
| Stale allowance | an allowance names a deleted file, or a file the report now shows above 0% |
| Stale entry | a baseline, `unmeasured` or waiver entry names a file that no longer exists |
| Unaccounted source | a `.ts` file under `src` is in none of the baseline, the `unmeasured` list and `zeroCoverageAllowed` |
| Runtime in unmeasured | an `unmeasured` file transpiles to anything but imports and re-exports |
| Allowance without a row | an allowance has no `files` row and no runtime code (it belongs in `unmeasured`) |
| Unmeasured now reported | a file in `unmeasured` appears in the measurement, or is also in the baseline |
| Floor | the baseline records fewer than `MIN_BASELINE_FILES` files, or the measurement has fewer |

Every finding names the file, the metric, the recorded and the measured value, and the difference in
percentage points.

**The tolerance is zero.** `TOLERANCE_PP` in `tools/domain-coverage-core.mjs` is `0`: a drop of one
hundredth of a point fails. It exists as a named constant so it can be raised after the numbers
have been compared across platforms; raising it is a reviewed change to that file, not a flag.

**The floor.** `MIN_BASELINE_FILES` is set to roughly nine tenths of the files the first real
measurement reported. Without it, an empty or truncated baseline — or a measurement that silently
measured almost nothing — would pass by having nothing to compare. The floor does not move with the
baseline: it only changes when someone edits it.

### A new source file with no coverage fails

Deliberately. A new file that no test reaches is the moment coverage is cheapest to write and
the moment a ratchet has the least to say, because there is no recorded number to fall below.
Letting it through would make the ratchet blind to exactly the files it should catch. The only way
through is an explicit entry in `zeroCoverageAllowed` with a non-empty reason, which a reviewer
reads in the baseline diff. Reasons are factual ("recorded at baseline; no test exercises it yet"),
never aspirational. The list can only shrink: once a file has any coverage its entry is stale and
fails the check until removed, and `update` removes it.

Files with 0 covered statements at the time the baseline was first recorded carry the initial
reason above; they are the input to whoever picks coverage work next, not a statement that they
are fine.

## The baseline file

`packages/domain/coverage-baseline.json` is written only in its canonical form (sorted keys, one
line per file, one line per allowance and waiver), and a guard asserts the committed file equals
its own canonical form. Do not hand-write numbers; run the update command.

| Key | Holds |
| --- | --- |
| `files` | `src/…` path to its four recorded percentages |
| `unmeasured` | source `.ts` files that produce no coverage entry; entries are added by hand, never by `update` |
| `zeroCoverageAllowed` | `src/…` path to the reason it may have no coverage: either a `files` row at 0% statements, or a never-loaded file with runtime code and no row |
| `waivers` | `src/…` path to `{ reason, statements, branches, functions, lines }` — a reviewed decline |

## Lowering a number on purpose

Sometimes a drop is right: dead code was deleted together with the tests that covered it, and the
remainder is genuinely lower. That is a decision, so it is recorded as one:

```powershell
pnpm coverage:domain:update --waive src/example.ts --reason "dead branch removed together with its tests"
```

The pair is repeatable and the reason must be non-empty. The waiver lowers that file's recorded
numbers to the measured ones and writes a `waivers` entry carrying the new numbers. It is refused for a file that has
not regressed, and for a file that produced no coverage at all.

## Cross-check against the base branch

Re-recording the baseline would otherwise make any red run green. So on pull requests CI also runs:

```powershell
node tools/domain-coverage.mjs guard-base --base origin/develop
```

It reads the committed baseline from the base ref with `git show` and compares it with the head
baseline entry by entry. Any file whose recorded number is lower at head than at base fails, naming
file, metric, from and to, **unless head has a `waivers` entry for that file that base does not
have** — so a hand-edit of the JSON cannot lower a number, and an old waiver cannot be reused. A
file dropped from the head baseline passes only if it no longer exists on disk. The guard always
prints the baseline files removed and added since the base (and appends the same table to the CI step
summary), so a moved file is in front of the reviewer. A move that keeps the basename and records a
lower number on any metric fails unless head carries a new waiver naming the added file. If the base has no
baseline file at all (the change that introduced it) the guard says so and passes. A base ref that
does not resolve fails rather than passes.

## Guards

- `tools/domain-coverage-baseline.test.mjs` reads the real baseline and the source tree and runs in
  the unfiltered `repo-guards` job, so a new source file with no baseline entry fails on any pull
  request.
- `tools/domain-coverage-core.test.mjs` proves every finding kind red and green on in-memory
  fixtures.
- `tools/domain-coverage-cli.test.mjs` runs the CLI as a child process against a throwaway package
  tree (`--root`) and a throwaway git repository, and pins the exit codes: findings, a malformed or
  missing baseline, a refused update, and every guard-base outcome.
- The baseline guard also fails on any `v8`, `istanbul` or `c8` ignore hint under `packages/domain/src`
  (they silently raise every metric) and on any source file that is not `.ts` or `.json` (a `.mts`,
  `.js` or upper-case `.TS` file is invisible to the ratchet and to the compiler).
- `tools/domain-coverage-workflow.test.mjs` pins the CI job: no escape hatch, the base-branch
  comparison on pull requests, membership in the required-check aggregator with skipped and
  cancelled counting as failure, and the path filter that triggers it.

## Known limits

- A move that also changes the basename is shown in the removed-and-added table but not blocked.
- The domain path filter does not cover fixtures that domain tests read from other packages' trees. A pull request touching only those skips the ratchet, the same pattern as the existing web filter.
- `guard-base` passes when the base has no baseline file. It cannot tell a change that introduces the baseline from a base that has lost it, so it is right only while every protected base branch already carries the file.
- Numbers were recorded on Windows with Node 24; CI is Ubuntu with Node 22. A first CI run may expose platform differences, and `TOLERANCE_PP` is the lever.
- Never-loaded files are visible only as allowances, and the per-pass untested-file sweep keeps printing its stack traces, as described above.
