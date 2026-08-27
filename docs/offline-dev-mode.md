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
| Account, Planning, Inventory | `apps/desktop/tests/fixtures/account-offline.json` — 8 heroes, 30 items, all five sections `resolved` | Real captured bodies |
| Live | `live-capture.bfcc` — 60 records decoding to 58 ticks, replayed at ~10 Hz | Real captured bytes, looped |
| Consent flow | Unchanged | Real |

You still have to grant consent in the app before anything appears — the nav is empty until you
do, exactly as in a real run. That is deliberate: the consent gate is part of what you want to be
able to exercise.

### The account fixture is generated, and re-keyed on purpose

`account-offline.json` is built by `apps/desktop/scripts/generate-offline-fixture.mjs`, which
drives the real route projections and the real `assembleAccountPayload` over the committed
calibration bodies. Regenerate it after either changes:

```bash
node scripts/generate-offline-fixture.mjs
```

Two things about it are worth knowing, because both are load-bearing and neither is obvious.

**Its `casa` section is the whole `/rotation` body**, per-hero rotation state included — not just
the inner `casa` child. `/rotation` projects identity, so that is what a real read produces, and a
fixture carrying only the house object leaves `normalizeRotation` with no heroes and the Live
screen with nothing to fold frames onto. Running the real projection is what keeps this true as
the projection changes.

**Its hero ids are re-keyed onto the replay capture's ids.** The account bodies and the capture
come from two different accounts with disjoint ids, and left alone the Live screen counts the
capture's heroes on the field while listing none of them — the roster join finds nothing, so it
looks broken rather than empty. Only the opaque id is substituted: every level, energy value,
name, rarity and rotation state stays as captured, and the capture's own bytes are never touched.

The capture shows nine distinct heroes on the field across its run and the roster holds eight, so
one capture hero stays unknown to the roster. That is a state the real app already handles — a
roster read older than the field it is describing.

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

Paths must be **Windows-style** (`C:/...` or `C:\...`). A Git-Bash path like `/c/Users/...` reaches
`readFileSync` unchanged and throws.

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
- **Its gear predates the level→set re-key.** The calibration bodies were captured 2026-08-12, and
  the 2026-08-15 patch moved every one of the 30 levels — so this fixture shows `wooden` and
  `forest` items at level 10 where the live game now gives `ember`. It is a correct record of that
  date, which is why `fixture-set-level-agreement.test.ts` excludes it by name rather than
  repairing it. Fine for layout and interaction work; do not read a set/level pairing off it. The
  repo holds no post-patch API-payload capture to regenerate from — the newer captures are save
  exports, a different shape.

## Guard rails

Every override is refused in a packaged build. `isReplayLiveSourceEnabled` takes `isPackaged` as an
argument rather than reading it, so the caller has to pass Electron's real answer and a packaged
build cannot be talked into replay by its environment — the same fail-closed shape
`sessionCfgPath` uses for the token override. `BFC_GAME_READER=fixture` is gated the same way.

A player's install therefore has no path into any of this, whatever is set in its environment.
