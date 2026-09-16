# PVP duel history

**Status (2026-09-16):** the desktop keeps every duel it sees settle while it is open, and the PVP
tab lists them under the account's standing as the game last reported it. Nothing is predicted and
no squad is picked; this is a record.

## What a duel looks like on the wire

A duel is asynchronous: the player presses Challenge, the server runs both squads in one room for
60 s and settles the result before the client shows anything. The client then makes two calls the
live tap already sees in plaintext:

1. the **duel result** — `venceu`, `fase` (the combat phase the duel was fought in, not the tier's
   floor), `filme` (a film id, `0` for none), `salas`, `segundos`, `atacante` and `defensor`
   (`{nome, herois, dano}` — `dano` is each side's score), `pontos_antes` / `pontos_depois`,
   `duelos_restantes` / `duelos_max`, `premio` (`won` when the rune chest landed, `lost` when a full
   bag lost it) and `estado`, the account's full PVP state (`faixa`, `fase` as the tier floor,
   `squad`, …);
2. the **film** — ~2 MB: `id`, `fase`, `fase_visual`, `hz`, `segundos`, `salas`, per-hero `a[]` /
   `d[]`, and `q[]`, 721 frames for a 60 s duel at 12 Hz.

Two more bodies pass without a duel: the **state** the client polls (the same object a result
carries as `estado` — points, tier, the next tier's threshold, quota, squad slots and the squad),
and the **ranking** the client fetches when the player opens the leaderboard (`by` names the
board — `pvp`, `hero` or `power` — with the top hundred and the player's own `me` entry). The tab's
standing section is drawn from the latest of each; only the `pvp` board's position is kept.

The app does not wait for the client to fetch either. When the PVP tab opens it asks for both
itself — `GET /pvp/state` and `GET /ranking?by=pvp&limit=100`, the routes and the limit the client
requests with — through the same consent gate, session token, transport and pacing as the account
cycle (`apps/desktop/src/main/pvp/pvp-reader.ts`, behind `pvp:refresh`). What a read finds goes
through the same recorder the tap feeds, so a body the app asked for and one the client fetched are
one path. A refresh within ten seconds of the last is refused as `rate_limited`, and a refusal
never blanks the screen: it keeps what it last held. In offline mode the reader answers `offline`
and the replayed bodies stand in.

The client fetches the film immediately after the result, and **the server answers 404 for it
seconds later**. The only way to ever have a film is to keep the body the moment it passes.

Every key is declared in `packages/game-api/src/pvp/lexicon.ts` and rendered into
[`wire-vocabulary.md`](wire-vocabulary.md); the identifier and parser reference a token only through
that lexicon, and the vocabulary guard scans `packages/game-api/src/pvp/` for a spelled-out one.

## What the tap has to read to see them at all

The game's server sends responses `Transfer-Encoding: chunked` and `Content-Encoding: gzip`
routinely, and the first duel fought against this tab (2026-09-16) left nothing in the log but
`live-source.http_body_skipped` lines under both reasons and no PVP verdict at all. Until then the
TLS-side decoder (`apps/desktop/src/main/live-source/tls-stream.ts`) skipped both shapes on
purpose — every body it had needed came plain, with a `Content-Length`, under 85 KB — and capped a
single body at 256 KiB, which a ~2 MB film could never have fit under anyway. The decoder now reassembles chunked framing,
inflates gzip/deflate/br, and holds up to 8 MiB of wire bytes per body; while a response's body is
still arriving it buffers rather than scanning the half-body for a frame start, since a compressed
body is arbitrary bytes. What it still skips, and says so: a body with neither a length nor
chunked framing, and an encoding it cannot inflate.

## What the film says about the opponent, and what it cannot

A result names the opponent, their hero count and their score, and nothing else; `estado` is the
player's own state. The film is anonymous by construction: `d[]` is one `{sk, t}` per defender
slot, and every frame's `h[]` carries side, slot, cell, position, a state and a walk speed — where
each hero went and what it was doing, never who it was. No hero id, name, level, rarity, gear or
ability crosses the wire for either side.

Per-hero damage is not in the film either. A bomb carries its cell, side, radius and fuse but no
placer, and damage exists only as the two per-side running totals. Measured on the first real film:
the placer is inferable from which of the side's heroes stands on the bomb's cell when it appears
(205 of 207 bombs unambiguous), but of the 193 frames where the player's total moved, 17 had
several of their bombs ending in the same tick and 19 had none — about a fifth of the damage would
be a guess, and two heroes hitting one prop cannot be split at all. A per-hero score is therefore
not shown: a figure that is right four times in five reads as data and is not.

## How the bodies are told apart

The tap hooks the client's TLS read side, so an observed body carries no URL. The account sections
are identified by complete-key-set fingerprints; the PVP bodies are not, because a result's state
object grows with the feature and a film is two megabytes of frames — refusing either over a key the
game added would drop the one body that cannot be re-fetched. `identifyPvpBody` names a result by
`venceu` (boolean) together with `filme` (number), and a film by `q` (array) together with `fase`
(number); a body carrying both pairs is refused. `identifyObservedBody` returns it as its own
`pvp` verdict ahead of the section fingerprints — the two can never both match, since no section's
complete key set contains either pair, and a test pins that against every fingerprint.

## What is kept, and why two tables

`apps/desktop/src/main/pvp/pvp-history.ts` adds two tables beside the account tables, over the same
handle the forge ledger borrows (`CREATE TABLE IF NOT EXISTS`, so `SCHEMA_VERSION` does not move):

- `pvp_duels` — one row per result, the fields as columns, keyed by `duel_key`;
- `pvp_films` — one row per film, keyed by film id, the body kept as the bytes that passed;
- `pvp_standing` — two rows, the latest state report and the latest points-board position, each
  with the time it was captured; a report identical to the one held is not rewritten, so nothing
  downstream is woken for a poll that repeats.

Two tables because the bodies arrive separately and in no guaranteed order. **A player who skips
the battle animation may never pull the film at all**; the server may issue none (`filme: 0`); the
tap may catch one body and miss the other; a film could land before its result. A duel is a row the
moment its result passes, a film is a row the moment it passes, and the read joins them, so the
list says whether each duel's film is held rather than dropping a duel for lacking one.

A filmed duel's key is its film id. A filmless one has no id, so its key is the figures no two
consecutive duels share — the points it moved between, the opponent, both scores and the room — so a
result the client re-sends, or one the offline replay serves again on every launch, is one row.

The account id is the one the session token names when the body passes; the tap sees no request,
so the body never says. It is `NULL` when consent is off or the token is unreadable.

## Where it flows

`LiveSource` hands a `pvp` verdict to its `onObservedPvpBody` seam with the route, the parsed body
and the raw bytes. `main/index.ts` wires that seam to `createPvpRecorder`, which parses, writes, and
pushes `pvp:changed` with the fresh list whenever something was actually kept. The renderer's
`lib/pvp/use-pvp-history.ts` is the one `pvp:history` read and the one `pvp:changed` subscription,
held for the window's lifetime, so a duel that settles while the player is on another tab is on the
list when they come back.

## Offline mode

The committed byte capture predates duels, so `pnpm dev:offline` serves the bodies in
`src/main/live-source/fixtures/pvp-duels-offline.json` — two results, one film, a state poll and a
ranking — once per tap,
ahead of the first frame, through the same HTTP decoder the capture's own REST bytes go through.
The two results are deliberately one filmed duel and one filmless, so the tab shows both states.
`BFC_REPLAY_PVP_FIXTURE` points the replay at another file; an empty string opts out.

## The list's filters

The duel list filters by opponent (every opponent fought, most fought first) and by result, on
the same toolbar row the Inventory and Forge screens use — compact controls at one height, no
labels over them, the shown-of-total count at the row's end. With an opponent chosen, a strip of
fact tiles under the toolbar prints the record against them — duels, won, lost, and both sides'
summed scores — over every duel held against that name whatever the result filter shows, so the
strip reads as the rivalry rather than as the rows under it. An opponent is a display name: the
result body carries no id for the other side.

## What it does not do yet

Nothing reads a film beyond its header. Grading a film, predicting a score and picking a squad are
later work; they are why the film is kept whole and never re-serialised.
