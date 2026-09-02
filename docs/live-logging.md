# Live logging: dedup, redaction, and the frame diagnostics

**Status (2026-08-24):** the main process's shared `log` (`apps/desktop/src/main/logging.ts`) is
now the boundary log — every record it emits, at every level including `debug`, is redacted and
deduplicated before it reaches `electron-log`. The live-source pipeline also gained two local
diagnostic artifacts: a bounded frame ring for parse-failure post-mortems, and a dev-gated raw
capture for building new replay fixtures. A third joined them since: a dev-gated recording of every
body and frame the tap observes, including the ones the app cannot identify (§4b).

## 1. The shared log's two guarantees

`apps/desktop/src/main/boundary-log/` (`redaction.ts`, `dedup.ts`, `index.ts`) is a pure module;
`logging.ts` is the one place it is wired to `electron-log`. Every call site that already imported
`log` from `./logging.js` is unchanged — the object it gets now carries these two properties on
every record, with no bypass:

- **Redaction is fail-closed.** `registerSecret(value)` makes a literal string unable to survive
  anywhere in a future log record, including inside a free-text error message nobody anticipated.
  The session token is different: `@bombfarm/game-api`'s `SessionToken` never hands its raw value
  to a caller, so it cannot be `registerSecret`'d directly. Instead `SessionToken#redactFrom(text)`
  scrubs the token out of a string from inside the class, and the redactor exposes a single-slot
  `setCredentialRedactor(redact)` — one slot, not a growing list, because there is only ever one
  session token live at a time. `main/index.ts` calls it the moment `readSessionToken` succeeds,
  wiring both the shared `log` and the live-source frame ring to the same closure.
- **Dedup key is the record with volatile fields stripped** (`heroId`, `hero`, `at`, `timestamp`,
  `ts` — `VOLATILE_FIELDS` in `dedup.ts`). The first occurrence of a key emits in full immediately;
  every recurrence is counted, not re-emitted, until `flush()` — called on `before-quit`, so a
  session's last window of suppressed counts is never silently lost — summarises it with an exact
  `suppressedCount`.

`debug` is a `Severity` in the boundary-log module itself, alongside `info`/`warn`/`error`, each
deduplicated independently and each routed to its own `electron-log` transport — `logging.ts` wires
one `createBoundaryLog` instance to all four.

## 2. Rotation field drops, deduplicated per field — not per hero

`normalizeRotation`'s `drops` array used to be discarded by `ingestRotation`
(`apps/desktop/src/main/live-source/live-source.ts`). It is now reported through `log.warn`, one
record per drop — but the wire path a drop names carries the hero's array index
(`heroes[3].energia_atual`), and reporting that verbatim would give eight heroes missing the same
field eight distinct dedup keys, eight lines a cycle, defeating the point. The index is stripped
before reporting (`heroes[3].x` → `heroes[].x`), so drops that differ only by which hero hit them
collapse to one line; drops that differ by field path, or by reason, stay distinct.

## 3. The frame ring — what led into a parse failure

`apps/desktop/src/main/live-source/frame-ring.ts`'s `FrameRing` holds a bounded, in-memory window
of recently decoded frame payloads, scrubbing only at dump time (most pushed frames are evicted
unread, so scrubbing on push would pay a cost that is usually thrown away). `tls-stream.ts` pushes
every decoded frame payload as it arrives (`TlsConnections#handleFrame`) and dumps to disk
(`dumpToDisk('parse-failure')`) the moment a frame the decoder cannot parse forces a resync
(`#advanceWs`'s catch). The ring is an optional dependency on `TlsConnectionsDeps`, threaded down
from `Tap`'s own optional `ring` dep — every existing construction site and test that omits it is
unaffected.

Sized against roughly 2 KB/frame at roughly 10 frames/second: **50 frames, 500 KB** — a five-second
window, generous enough above the ~100 KB average to absorb a burst of larger combat frames without
holding more raw payload in memory than that.

The ring carries the same single-slot `setCredentialRedactor` the shared log does — `LiveSource`
owns the ring and applies it in the same secret-scrubbing pass `registerSecret` already runs, so a
dump is provably free of the session token, not just `account_id`/`player_name`. It also now
redacts by key name using `boundary-log/redaction.ts`'s exported `isSensitiveKey` — the same
`token`/`cookie`/`password`/`authorization`/… list the boundary log itself checks, one list shared
rather than duplicated, so a payload key with one of those names is blanked even when its value was
never registered as a secret.

What stays separate, deliberately: the ring scrubs at dump time rather than at push (§3's opening
paragraph), keeps its own `PERSONAL_FIELDS` field-name strip (`account_id`/`player_name` are
removed outright, not just blanked), keeps its own fail-closed `unreadable` placeholder for a frame
that is not valid UTF-8, and has no dedup or `maxDepth`/`maxNodes` traversal budget — the boundary
log's `redact()` and the ring's `scrubFrame` are two call sites over the same key list, not one
shared redaction function.

## 4. The frame capture — seeding a new replay fixture

`apps/desktop/src/main/live-source/frame-capture.ts`'s `createFrameCapture` records the raw,
never-re-encoded bytes, so the resulting file replays through the exact same decoding path that
read it live (see §5). Three independent gates decide whether anything is ever written — the build
must be **unpackaged**, the app flavor must be `dev`, **and** `BFC_LIVE_FRAME_CAPTURE=1` must be
set — because no one of them is enough on its own.

The packaging gate is not redundant with the flavor one. `package:dev` produces a **packaged**
artifact stamped with the `dev` flavor, and a packaged build returns that baked stamp, so
`isPackaged` and `flavor === 'dev'` can both be true at once; a flavor-only gate could therefore be
satisfied by an installed build. `isPackaged` is a required dependency rather than something the
factory reads for itself, so the caller has to pass Electron's real answer and no environment
variable can talk an install into capturing. A refusal caused by packaging logs its own distinct
event, so the log names which gate refused rather than misreporting a packaged dev build as being
outside dev.

**The capture is a record stream, not a flat byte dump, and it has to be.** The hook fires for
every TLS read in the game client, and those reads interleave many connections: a real 1.5 MB
capture held one combat websocket alongside **nine** REST connections, with a 124 KB inventory
response landing in the middle of the frame stream. `TlsConnections` demultiplexes by `ctx`, so a
capture that concatenated every read into one file could not be replayed at all — REST bytes would
be fed to the websocket's frame decoder. Each record therefore carries its own `ctx`.
`capture-format.ts` owns the layout (a `BFCC` magic byte header, then per record a ctx type tag,
length-prefixed ctx, and length-prefixed payload, little-endian) and is pure and fs-free so the
writer and any replay harness share one definition. `readCaptureRecords` stops cleanly at a
truncated tail, so a capture cut short by a hard app exit still reads up to its last whole record.

Wired at `Tap#onCandidateRead`, gated to the **confirmed winner only**: candidate bytes from a
losing address never came from the game's real stream, and pushing them would corrupt a fixture
meant to be replayed byte-for-byte. Bytes from the read that confirms the winner, and every read
after it, are captured; nothing before confirmation is (there is no way to know which candidate is
real until one is).

Sized for a several-minute farming session on the same basis: **20 MB**, roughly 1,000 seconds of
capture at the same 2 KB/10 fps rate — enough to produce a realistic fixture without an unbounded
dev-machine file. `createFrameCapture`'s append port opens and closes its own file handle on every
write, so there is no persistent handle for `close()` (called on tap teardown) to leak, and a
reattach after a consent revoke keeps appending correctly.

`createFrameCapture` emits one `info` record naming the byte cap the moment both gates are open, so
a maintainer who enables it in dev gets a log line confirming it is running instead of silence.

## 4b. The observation capture — what the app made of the traffic

`apps/desktop/src/main/live-source/observation-capture.ts` records, as newline-delimited JSON,
every REST body and every live frame the tap observes. It is the complement of §4's capture rather
than a replacement: `.bfcc` reproduces the byte stream, this reproduces what the app made of it —
a verdict, a sequence number, a timestamp, and the body itself.

**Its reason to exist is the traffic the app throws away.** The hook is on the TLS read side, so an
observed body carries no URL and no method; `identifyObservedBody` matches it against five route
fingerprints and returns `unidentified` for everything else, and `LiveSource` drops those after one
log line naming a byte length. Anything the game sends that the app does not model — what a cage
open actually returns, what a chest open actually contains — is in that discarded set. The recorder
is therefore wired **above** those early returns, on the raw bytes.

```powershell
pnpm dev:capture
```

That sets `BFC_OBSERVATION_CAPTURE=1` and `BFC_FLAVOR=dev` as defaults, announcing either if your
environment already holds one, then builds and starts the dev app against the real client. It
deliberately does **not** set the replay live source: replayed frames come from a committed capture
and would answer nothing.

**The gate is the same fail-closed shape `sessionCfgPath` uses**, and it is asked twice — once at
the call site (`isObservationCaptureEnabled(env, isPackaged)`) and again inside the factory, which
returns an inert sink when the build is packaged **or** the mode is not enabled. Both parameters are
required and `isPackaged` is never read from the environment, so an installed build cannot be talked
into recording live account traffic; it produces no file and logs no line advertising that the mode
exists.

**Records.** One JSON object per line. Every record carries `seq` (monotonic, and authoritative for
ordering — two observations can share a millisecond), `at`, the most recent frame's `phase` and
`wave` as explicit nulls until a frame arrives, and `redaction`. The kinds are:

| `kind` | Carries |
| --- | --- |
| `body` | `byteLength`, the `verdict` (`identified` with its section, `unidentified`, `ambiguous` with its sections, or `parse_failed`), and the parsed body — **including** when the verdict is `unidentified` |
| `frame` | `wire`: the frame object verbatim, decoded keys and the keys `toLiveTick` never reads alike |
| `mark` | `label` — an annotation you typed while playing |
| `session` | `started` (naming the destination), each currency transition, `redactor_armed`, `stopped`, `append_failed` |

A body that is not valid JSON is recorded with the `parse_failed` verdict and its byte length
rather than dropped: "we saw something we could not read" is a finding. Currency transitions are
recorded so a run where the tap never attached says `consentMissing` or `clientNotStreaming` in the
file itself, instead of being an empty file that reads as "nothing happened".

**`redaction` says which scrub was in force**, and it has two values. `armed` means the value-level
credential redactor was installed when that line was written; `key-name-only` means it was not yet.
The redactor is built from the first successful session-token read, which happens after startup, so
the earliest lines of a recording can predate it — the stamp makes that legible instead of leaving
it to be assumed. Three layers apply to every record regardless: a `SessionToken` value renders as
the redaction marker from its own type, sensitive-named keys are blanked at any depth without
needing to know the value, and `account_id` / `player_name` are removed outright.

**The token cannot reach the file, structurally.** The module exports no way to append text: every
record goes through one encoder that scrubs before it stringifies, so bypassing redaction means
deleting that call rather than forgetting it. A test plants a sentinel token, produces a file, and
asserts the sentinel does not occur in it as raw text.

**Markers.** Type a note into the launcher's terminal and press Enter while you play; it is written
to `mark.txt` beside the recording, prefixed with an incrementing ordinal so the same note twice
still changes the file, and main polls that file for content changes. Content identity rather than
mtime, because a same-millisecond rewrite is invisible to mtime on Windows. A read failure costs
the annotation and never the recording.

**Failure never disturbs the tap.** A throwing append latches the recorder off, warns once however
many observations follow, and returns; `LiveSource` calls it through `?.` and ignores the result. A
line is written as a single buffer including its newline, and a write that fails part way through
truncates back to the offset that line started at, so the file always ends on a record boundary.

**Volume, and your own cleanup.** The wire tick is roughly 2 KB at about 10 frames a second —
around 70 MB per hour — and there is deliberately no size cap, because a cap risks truncating the
one interesting body. Start and stop the mode by hand. **Recordings hold live account data from
your own session, nothing deletes them for you, and they must never be committed.**

## 5. Where the artifacts land, and producing a fixture from a capture

All three are local files written beside the user data directory — `live-frame-dump.json` (the
ring's scrubbed dump), `live-frame-capture.bin` (the raw capture), and
`observation-capture/observed-<YYYYMMDD-HHmmss>.ndjson` (§4b, one file per run so two sessions
never share one) — nothing is transmitted anywhere.

`fixtures/live-capture.bfcc` is a committed capture from a real session, produced by this path. To
make another:

1. Run a `dev`-flavored build with `BFC_LIVE_FRAME_CAPTURE=1` set, and play through the session you
   want captured.
2. Copy `live-frame-capture.bin` out of the user data directory. **Do not commit it as-is.**
3. Keep only the combat-websocket connection. Every other `ctx` in the file is a REST connection,
   and REST response bodies are the one place `account_id` and `player_name` appear — dropping
   them removes the entire personal-data surface rather than trying to rewrite bodies in place
   (which would also invalidate their `Content-Length`).
4. Trim to a contiguous run of **whole records**. Records are the reads the app actually received,
   so replaying them one for one reproduces the exact chunk boundaries the decoder saw live — which
   matters, because chunk boundaries are what the decoder's resync path is exercised by.
5. Rewrite the `ctx` to a stable label. Live values are raw heap addresses from the game process:
   noise that changes every run and has no business in a committed artifact.
6. Verify before committing: the bytes must contain neither `account_id` nor `player_name`, nor the
   session token. `replay-stream-scrubbed.test.ts` is the committed guard, but run the check while
   producing the fixture too — a capture is raw game traffic, not a scrubbed export, and this repo
   is public.

Fixtures are binary. `.gitattributes` declares `*.bin binary` so nothing git sniffs as text can be
rewritten on checkout — the synthetic stream contains literal CRLF bytes as HTTP header
terminators, and normalizing them would corrupt it silently.

## 6. Why the fixture has to come from a real session

The decoder and the synthetic generator were written against the same assumed field names, so they
agreed with each other and both disagreed with the game. Every test passed. Measured against the
first real capture, the shipped decoder produced **zero** hero energy values across 381 frames,
zero room-HP readings, and 336 hit entries with no damage on any of them — because the wire sends
`e`, `room_hp` and `d` where the decoder read `energy`, `roomHp` and `amount`. `gold` arrives as a
string of digits and was being passed straight into a number-typed contract field.

Nothing errored, because the frames decoded fine at the WebSocket layer and carried the expected
message type. The panel would simply have shown nothing and blamed the tap.

A fixture that shares the implementation's assumptions cannot catch this class of defect. That is
the argument for `live-capture.bfcc` existing, and for regenerating it after a game patch rather
than trusting that a passing suite means the wire still looks the way it did. The wire vocabulary
itself now lives in `packages/game-api/src/live-frame/lexicon.ts` and is rendered into
`docs/wire-vocabulary.md`, so the abbreviations are translated in exactly one place instead of
being spelled inline at the point of use.
