# Offline dev mode

Runs the desktop app with **no game running and no server reachable**. Both halves of the read
path are replaced by committed fixtures: the account sections come from a fixture payload instead
of the five REST routes, and the live tick stream is replayed from a recorded byte capture instead
of a hook into the game process.

```bash
pnpm dev:offline
```

That is the whole command. It sets no environment variables you have to remember, prints the ones
it applied, and every one of them is overridable.

## What it gives you

| Surface | Source | Fidelity |
| --- | --- | --- |
| Account, Planning, Inventory | `apps/desktop/tests/fixtures/account-offline.json` — 13 heroes, 221 items, all five sections `resolved` | Real captured bodies |
| Live | `live-capture.bfcc` — 60 records decoding to 58 ticks, replayed at ~10 Hz | Real captured bytes, looped |
| Consent flow | Unchanged | Real |

You still have to grant consent in the app before anything appears — the nav is empty until you
do, exactly as in a real run. That is deliberate: the consent gate is part of what you want to be
able to exercise.

### The account fixture is generated, and stitched from two captures

`account-offline.json` is built by `apps/desktop/scripts/generate-offline-fixture.mjs`. Regenerate
it after either input changes:

```bash
node scripts/generate-offline-fixture.mjs
```

It stitches two committed captures into one account:

- **a post-2026-08-15 save export** supplies `account`, `heroes`, `skills` and `items`. Its section
  shapes are the ones the five routes already return, so nothing is translated. Being post-patch is
  what keeps its gear agreeing with the current `catalog.setsByLevel` — a fixture built from the
  older API calibration bodies does not, and has to be excluded from
  `fixture-set-level-agreement.test.ts` rather than satisfying it.
- **the replay capture** supplies who is on the field and each of their energy fractions.

Three things about it are worth knowing, because none is obvious and all three are load-bearing.

**Its `casa` section is the whole `/rotation` body**, per-hero rotation state included — not just
the inner house object. `/rotation` projects identity, so that is what a real read produces, and a
save export carries only the house object. A fixture without the per-hero half leaves
`normalizeRotation` with no heroes and the Live screen with nothing to fold frames onto.

**Its hero ids are re-keyed onto the capture's.** The save and the capture are two different
accounts with disjoint ids, and left alone the Live screen counts the capture's heroes on the field
while listing none of them — the roster join finds nothing, so it looks broken rather than empty.
Only the opaque id is substituted, and the capture's bytes are never touched.

**Its on-field set matches the capture's.** The nine heroes the capture shows fighting are the nine
the rotation marks `EM_CAMPO`, which is also exactly `field_slots`. When those two disagreed, the
field list visibly alternated between the rotation's answer and the capture's, because every
rotation ingest replaces the field with a tick built from the rotation's own on-field set.

Each on-field hero's energy is real on both halves: the fraction is the capture's observed value,
the maximum is the save's own `stats.energia`. The four heroes the capture never shows are resting,
and neither capture records a resting hero's energy — those reuse the capture's observed fractions,
cycled. That is the one place this fixture puts a measurement somewhere it was not measured, so
read a recovery countdown here as layout, never as a reading.

## Why it does not fake a server

The obvious shape is a mock HTTP server on localhost. That shape is wrong here, for two reasons
that are both load-bearing rather than stylistic.

`HttpRequest.host` is a **literal type** pinned to the real API host, and `isTrustedHttpRequest`
re-checks it at runtime before the transport is ever called. A request to localhost is refused by
construction, and getting one through means weakening a guard that exists to make an unintended
host unexpressible. The fixture reader sits above that boundary and never touches it.

The tap is not an HTTP client at all — it reads bytes out of the game client's own TLS stream. A
server on localhost has nothing to say to it. What replaces it is a reader over a recorded capture,
pushed through the same `TlsConnections` decoder the real tap uses, so what the app folds into a
`LiveView` came off the wire rather than out of a hand-written fixture.

That last point matters more than it looks. A synthesised live frame is written against what we
*believe* the wire says, and the decoder is written against the same belief — so generator and
decoder agree with each other while both disagree with the game, and the test suite stays green
through it. Replaying recorded bytes is the only version of this that can fail honestly.

## Running it beside a real install

This is the intended arrangement once the game is live: a packaged build tapping your real
account, and a dev build in offline mode on the same machine.

They do not collide.

- **Different user data.** Flavors already separate them — `Bomb Farm Companion (Dev)` against
  `Bomb Farm Companion`. Nothing the dev build writes reaches the real install's database.
- **Different renderer port.** Offline mode defaults to **3100**, not 3000, so it also coexists
  with `pnpm dev:web`. `dev.mjs` exits rather than sharing a port, so this is the difference
  between working and a startup error.
- **No contention for the game process.** Replay mode never lists processes and never loads the
  instrumentation runtime. Two builds hooking one process is a situation that simply cannot arise.

## Overrides

Set any of these before the command; the script only fills in what you left blank.

| Variable | Default in offline mode | What it does |
| --- | --- | --- |
| `BFC_GAME_READER` | `fixture` | `fixture` reads a payload file; `memory` uses the real reader |
| `BFC_FIXTURE_ACCOUNT_FILE` | `tests/fixtures/account-offline.json` | Any `AccountPayload`-shaped JSON |
| `BFC_LIVE_SOURCE` | `replay` | `replay` reads a capture; anything else uses the real tap |
| `BFC_REPLAY_CAPTURE` | the committed `live-capture.bfcc` | Any `.bfcc` capture |
| `BFC_RENDERER_PORT` | `3100` | Renderer dev-server port |
| `BFC_USER_DATA_DIR` | `.offline-user-data/` at the repo root | Where this mode's database lives |

Paths must be **Windows-style** (`C:/...` or `C:\...`). A Git-Bash path like `/c/Users/...` reaches
`readFileSync` unchanged and throws.

### A stale override is the most likely thing to go wrong

`$env:NAME = '...'` in PowerShell outlives the command that used it, and this script honours a
variable that is already set. So an override from an earlier run silently wins — and the symptom
is not an error but a quietly wrong screen.

The startup banner marks every value that came from your environment rather than from this script.
Read it before believing what the app shows. To clear the lot:

```powershell
Remove-Item Env:BFC_GAME_READER, Env:BFC_FIXTURE_ACCOUNT_FILE, Env:BFC_LIVE_SOURCE, Env:BFC_RENDERER_PORT, Env:BFC_USER_DATA_DIR -ErrorAction SilentlyContinue
```

The specific failure worth recognising: an account fixture whose `casa` section holds only the
house object leaves the Live screen listing **hero ids with no names**, and the House panel
reporting that no house data was sent — `normalizeRotation` found no per-hero rotation state to
join the roster against. The script checks for this and warns by name at startup.

### Its database is its own

This mode keeps its account database in `.offline-user-data/` at the repo root, not in the shared
`Bomb Farm Companion (Dev)` profile. Committed sections outlive the fixture that produced them, so
without that separation a `casa` section written by one fixture reaches the Live screen on a later
run driven by a different one — the same id-only rows, from a cause the banner cannot show you.
Delete the directory to reset.

### Recording your own capture

`BFC_LIVE_FRAME_CAPTURE=1` on a **dev** flavor with the real game running writes
`live-frame-capture.bin` into the flavor's user-data directory. Point `BFC_REPLAY_CAPTURE` at it to
replay your own session instead of the committed one. See [live-logging.md](live-logging.md) for
what that capture does and does not redact.

## What it cannot do

Worth knowing before you trust a screen you developed against it.

- **The capture is about six seconds of one wave.** 58 ticks, 21 hits, 10 loot pops, nine distinct
  gold values, one connection. It exercises the decode and render path. It does not exercise
  anything that varies over minutes — cadence, room clears, rotation cycles.
- **It loops.** Reaching the end restarts from a fresh decoder, so gold and wave jump backwards at
  the seam. Anything fitting a trend across the loop point will see a discontinuity that no real
  session produces.
- **No bonus window.** `bonus_secs` / `bonus_mult` are documented in
  [wire-vocabulary.md](wire-vocabulary.md) but absent from this capture — it was taken outside one.
- **One account, one moment.** The account fixture is a single capture pair. Any regime it does not
  cover — a different phase band, a House-bound account, VIP active — is not represented, and
  hand-authoring one reintroduces exactly the failure mode described above.
- **No error responses.** Cooldown, unauthorized and malformed-body handling are covered by unit
  tests, not by this mode.
- **Its resting-hero energy is reassigned, not measured.** See above — field countdowns are real
  on both halves, recovery countdowns are shaped like real ones but are not readings.

## Guard rails

Every override is refused in a packaged build. `isReplayLiveSourceEnabled` takes `isPackaged` as an
argument rather than reading it, so the caller has to pass Electron's real answer and a packaged
build cannot be talked into replay by its environment — the same fail-closed shape
`sessionCfgPath` uses for the token override. `BFC_GAME_READER=fixture` is gated the same way.

A player's install therefore has no path into any of this, whatever is set in its environment.
