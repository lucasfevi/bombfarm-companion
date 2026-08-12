# The fidelity gate (MP2 F4, LHP-13)

**Status:** ships pre-F2. `pair.json → live.source` is `"export-derived"`; the cross-source
*equality* half is a **regression fence, not a discovery instrument** — both committed captures
share an origin, so it cannot find a reader bug that does not exist yet (design §1.1). The two
halves that are fully real today, and are what `LHP-13`'s exit clause actually turns on, are:

1. **The degraded-input guard** (`FID-05`/`06`/`07`) — a live capture whose derived fidelity
   grade is not `full` fails the gate, naming every non-`resolved` section and its literal
   status, before any sheet comparison is attempted.
2. **The discrimination (mutation) suite** — eight committed-pair mutants, each proven to fail
   the gate with a specific error code and message content
   (`packages/domain/tests/fidelity-gate-discrimination.test.ts`).

Once F2 (`mp2-live-account-read`) lands and `live.source` flips to `"memory-assembled"`, the
equality half becomes the real cross-source proof — see [F2 handoff](#f2-handoff) below.

## What the gate proves, and what it does not (pre-F2)

| Claim | Status pre-F2 |
| --- | --- |
| A capture graded less than `full` fails the gate, naming every degraded section | ✅ Real |
| A mutated payload (coerced type, dropped bound, truncated object, roster drift) fails the gate | ✅ Real — proven against the real committed pair, not a synthetic one |
| The live-sourced path produces the same sheet numbers as a genuinely independent memory read | ❌ Not yet — `live-capture.json` is *derived from* `export-capture.json`, so this half only proves the comparator and framing contract are internally consistent |

Do not read a green run pre-F2 as proof the memory reader is correct. It proves the *detector*
is correct and that a degraded read is caught. The subject — a real memory-assembled payload —
arrives with F2.

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
    "source": "export-derived",   // or "memory-assembled" once F2 lands
    "gameBuild": "string",
    "capturedAt": "ISO-8601",
    "scrubbed": ["account_id", "player_name"],

    // Required only when source is "memory-assembled":
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

When F2 (`mp2-live-account-read`) lands its reader, in the **same PR**:

1. Replace `live-capture.json` with the reader's own serialised `AccountPayload` for the
   reference account (still scrubbed of `account_id`/`player_name`).
2. Flip `pair.json → live.source` to `"memory-assembled"`.
3. Add `live.readerVersion` (the reader's version string) and `live.fingerprints` — the
   per-anchor schema fingerprints from F2's own separate calibration capture (`AD-019`'s
   API-oracle calibration procedure, not this gate).
4. Recompute `expected.heroes`/`items`/`statComparisons` from the real reader output.

Four assertions tighten automatically the moment the token flips (design §1.2) — no test code,
no workflow, no other assertion needs editing:

| Assertion | `export-derived` | `memory-assembled` |
| --- | --- | --- |
| Derivation | must be byte-reproducible from the export via `frameLiveCapture` | must **NOT** be byte-equal to the framed export |
| Provenance | `gameBuild`/`capturedAt` required | + `readerVersion`, non-empty `fingerprints` required |
| Fidelity block | synthesised, stamped `resolved` | must be the reader's own output |
| Suite title | says "regression fence" | drops that caveat — now the real cross-source proof |

`validation.md` for this feature must be re-run once F2 lands, since the equality half's meaning
changes.
