# PVP duel history

**Status (2026-09-16):** the desktop keeps every duel it sees settle while it is open, and the PVP
tab lists them. Nothing is predicted and no squad is picked; this is a record.

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

The client fetches the film immediately after the result, and **the server answers 404 for it
seconds later**. The only way to ever have a film is to keep the body the moment it passes.

Every key is declared in `packages/game-api/src/pvp/lexicon.ts` and rendered into
[`wire-vocabulary.md`](wire-vocabulary.md); the identifier and parser reference a token only through
that lexicon, and the vocabulary guard scans `packages/game-api/src/pvp/` for a spelled-out one.

## How the two bodies are told apart

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
- `pvp_films` — one row per film, keyed by film id, the body kept as the bytes that passed.

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
`src/main/live-source/fixtures/pvp-duels-offline.json` — two results and one film — once per tap,
ahead of the first frame, through the same HTTP decoder the capture's own REST bytes go through.
The two results are deliberately one filmed duel and one filmless, so the tab shows both states.
`BFC_REPLAY_PVP_FIXTURE` points the replay at another file; an empty string opts out.

## What it does not do yet

Nothing reads a film beyond its header. Grading a film, predicting a score and picking a squad are
later work; they are why the film is kept whole and never re-serialised.
