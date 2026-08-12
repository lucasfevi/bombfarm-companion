# The fidelity gate (MP2 F4, LHP-13)

**Status (2026-08-12):** F2 has merged ([#63](https://github.com/lucasfevi/bombfarm-companion/pull/63)),
but **the gate has not been retargeted onto it yet** — see [F2 handoff](#f2-handoff). `pair.json →
live.source` is still `"export-derived"`, so the cross-source *equality* half remains a
**regression fence, not a discovery instrument** — both committed captures share an origin, so it
cannot find a reader bug (design §1.1). The two halves that are fully real today, and are what
`LHP-13`'s exit clause actually turns on, are:

1. **The degraded-input guard** (`FID-05`/`06`/`07`) — a live capture whose derived fidelity
   grade is not `full` fails the gate, naming every non-`resolved` section and its literal
   status, before any sheet comparison is attempted.
2. **The discrimination (mutation) suite** — eight committed-pair mutants, each proven to fail
   the gate with a specific error code and message content
   (`packages/domain/tests/fidelity-gate-discrimination.test.ts`).

Once `live.source` flips to `"api-assembled"`, the equality half becomes the real cross-source
proof — see [F2 handoff](#f2-handoff) below.

> **`D24` changed which token that will be.** This document was written when F2 was scoped as a
> *memory* reader, so the ladder's post-F2 branch is `"memory-assembled"`. F2 shipped as an
> **API** source (`@bombfarm/game-api`) instead. The handoff below is therefore still pending,
> and it needs a **third** token — `"api-assembled"` — rather than the flip originally planned.
> `"memory-assembled"` is **not** renamed or removed: telemetry is still memory-sourced, and
> renaming a merged tripwire rewrites its meaning retroactively.

## What the gate proves, and what it does not (today)

| Claim | Status today |
| --- | --- |
| A capture graded less than `full` fails the gate, naming every degraded section | ✅ Real |
| A mutated payload (coerced type, dropped bound, truncated object, roster drift) fails the gate | ✅ Real — proven against the real committed pair, not a synthetic one |
| The live-sourced path produces the same sheet numbers as a genuinely independent memory read | ❌ Not yet — `live-capture.json` is *derived from* `export-capture.json`, so this half only proves the comparator and framing contract are internally consistent |

Do not read a green run as proof the account reader is correct. It proves the *detector* is
correct and that a degraded read is caught. The subject — a payload from a genuinely independent
origin — arrives when the handoff below is done.

## How the gate is structured

- **Loader** (`tests/helpers/fidelity-pair.ts`) — reads `pair.json` plus the two captures, throws
  a typed `FidelityGateError` on every failure mode (missing/unreadable/malformed file, invalid
  manifest, an unscrubbed capture). Never returns a partial result.
- **Fidelity guard** (`tests/helpers/fidelity-grade.ts`) — rejects a live capture with no
  `fidelity` block, a malformed block, or a grade other than `full`.
- **Comparator** (`tests/helpers/fidelity-compare.ts`) — cross-source equality over every hero's
  `naked`/`gearedOverride`/`birth` sheets (at `SHEET_ABS_TOL`, imported from
  `tests/helpers/sheet-math-fixtures.ts` — never a second, live-only tolerance), account-level
  fields, warnings, and inventory. Also diffs the two raw payloads' `account` block and each raw
  hero object directly (`compareRawAccountFields` / `compareRawHeroFields`) — some raw fields
  (e.g. `account.gold`, a hero's `stat_ranges`) are not projected into the parsed output at all,
  so only a raw diff can catch them silently drifting.
- **Entry point** (`tests/helpers/fidelity-gate.ts`) — `runFidelityGate` runs the whole pipeline
  in order and enforces the manifest's executed-work floors (`expected.heroes`/`items`/
  `statComparisons`), so an empty roster cannot pass a vacuous loop.
- **CI** (`.github/workflows/ci-fidelity.yml`) — path-filtered on `apps/desktop/**`,
  `packages/game-data/**`, `packages/domain/**`, `packages/contracts/**`; its
  `fidelity-gate-required` check fails on `skipped`/`cancelled`, not just on an active failure.

## The `pair.json` manifest, field by field

```jsonc
{
  "schemaVersion": 1,
  // A human label for the account both captures are of — NOT an identifier. Account identity
  // for the gate's purposes is established by the roster's sourceId set, not this label.
  "accountLabel": "string",

  "export": {
    "file": "export-capture.json",
    "gameBuild": "string",     // e.g. "2026.07.31" — maintainer-supplied, not derived from data
    "capturedAt": "ISO-8601",
    "scrubbed": ["account_id", "player_name"]
  },

  "live": {
    "file": "live-capture.json",
    "source": "export-derived",   // ladder token — see F2 handoff for "api-assembled"
    "gameBuild": "string",
    "capturedAt": "ISO-8601",
    "scrubbed": ["account_id", "player_name"],

    // Required only for a non-"export-derived" source:
    "readerVersion": "string",
    "fingerprints": { "account": "string", "heroes": "string", "skills": "string", "casa": "string", "items": "string" }
  },

  // Executed-work floors — the gate throws underComparison if fewer comparisons than this ran.
  "expected": {
    "heroes": 0,
    "items": 0,
    "statComparisons": 0
  }
}
```

`live.readerVersion` and `live.fingerprints` are **absent** while `live.source` is
`"export-derived"` — they become required the moment the token flips.

## Producing the capture pair locally

1. Obtain a save export (`docs/SAVE_EXPORT.md`) for the account you want as the reference.
2. Scrub it: remove `account.account_id` and `account.player_name`, and **only** those two
   fields — `scrubPersonalFields` in `tests/helpers/fidelity-pair.ts` does this deterministically.
   Save the result as `export-capture.json`.
3. Derive the live side with `frameLiveCapture(exportCaptureObject, { capturedAt })` (same file).
   This lifts the five `AccountPayload` sections, drops the two file-only keys
   (`export_version`, `generated_at`), and attaches a five-section `fidelity` block stamped
   `resolved`. Save the result as `live-capture.json`.
4. Write `pair.json` per the schema above, with `live.source: "export-derived"` and `expected.*`
   set to the **measured** counts from actually parsing both captures — never guessed.
5. Run `pnpm vitest run --project @bombfarm/domain fidelity` to confirm the pair passes.

Running the suite without the fixtures present fails loudly, naming the absolute path and
pointing back at this document (`FidelityGateError('fixtureMissing', …)`).

### The scrub rule is machine-enforced

`loadFidelityPair` throws `unscrubbedFixture` if either committed capture's raw JSON text still
contains the string `account_id` or `player_name` anywhere. Do not hand-edit around this — the
committed pair must genuinely carry neither field.

## F2 handoff

**Still outstanding.** It was written to happen in F2's own PR; `D24` changed F2's source from
memory to the API mid-flight, and the retarget did not land with it. Do it as its own change:

1. Replace `live-capture.json` with the API source's own serialised `AccountPayload` for the
   reference account (still scrubbed of `account_id`/`player_name`).
2. Add `'api-assembled'` to `LiveSource` and to `PROVENANCE_LADDER`
   (`packages/domain/tests/helpers/fidelity-gate.ts`) with a non-empty assertion list, and bump
   the ladder's key-set assertion in `fidelity-gate.test.ts` from two tokens to three. **Add —
   never rename `'memory-assembled'`**: it is a merged tripwire, and telemetry is still
   memory-sourced, so the token keeps a real future subject.
3. Set `pair.json → live.source` to `"api-assembled"`.
4. Add `live.readerVersion` — now `@bombfarm/game-api`'s version, not a memory reader's — and
   `live.fingerprints`, the per-anchor schema fingerprints from the separate calibration capture
   (`AD-019`'s API-oracle procedure, not this gate).
5. Recompute `expected.heroes`/`items`/`statComparisons` from the real API output.

Four assertions tighten the moment the token changes (design §1.2) — the ladder is the only
place that needs new code; no workflow and no other assertion needs editing:

| Assertion | `export-derived` | `api-assembled` |
| --- | --- | --- |
| Derivation | must be byte-reproducible from the export via `frameLiveCapture` | must **NOT** be byte-equal to the framed export |
| Provenance | `gameBuild`/`capturedAt` required | + `readerVersion`, non-empty `fingerprints` required |
| Fidelity block | synthesised, stamped `resolved` | must be the source's own output |
| Suite title | says "regression fence" | drops that caveat — now the real cross-source proof |

**The gate's honest limitation improves under `api-assembled`, and by more than the original
memory-sourced plan would have given it:** a save export and a live REST response are genuinely
independent origins, so the equality half becomes a real discovery instrument rather than the
regression fence `AD-026` settled for.

`validation.md` for this feature must be re-run once the token changes, since the equality
half's meaning changes.
