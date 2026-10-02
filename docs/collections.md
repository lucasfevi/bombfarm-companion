# Collections

**Status (2026-10-02):** the desktop reads the game's Collections state when asked and keeps the
last good one. Collections are the set books the 2026-09-30 patch added: sacrificing pieces of an
equipment set writes pages into that set's book, and each book grants a permanent, account-wide
percentage bonus on one or more axes. The app never sacrifices anything.

**The committed fixture is synthetic, not a capture.** Its set table — page values and caps — is the
game's own; its progress is invented to cover the interesting states (a book finished, one with a
later page ahead of an earlier one, a three-effect book, an axis over its cap). Nothing in it is a
real account's progress, and a capture of a real read is still owed as a second witness to the
shape.

## What the body is

The client requests `GET /colecao` for its panel, and one body carries everything: the catalog and
the account's progress in it. Top level: `versao`, `ligada`, `parcial_pct`, `upgrades`, three
per-axis records (`tetos` the caps, `brutos` the uncapped sum, `totais` what the account gets), `sets`
(each book with its pieces sacrificed per rarity page and its effects) and `pecas` (every piece of
every set, with the pages it is sacrificed on). Percentages are in percent (`13.65` is +13.65%).
Every key is declared in `packages/game-api/src/collections/lexicon.ts` and rendered into
[`wire-vocabulary.md`](wire-vocabulary.md).

## The page rule

A page grants its whole increment once all eight pieces are sacrificed on it; until then each piece
pays `parcial_pct` percent of the increment divided by eight, so every piece already counts for
part of its page. The server states what each effect grants now, and that is what the app displays;
only what the server does not send — per-page gains, what one more piece would add — is worked out
(`buildCollectionBoard` in `@bombfarm/domain`).

## How the body is told apart, and read

The tap hooks the client's TLS read side, so an observed body carries no URL. The state is told
apart by its complete key set at every level (`isCollectionsStateBody`), and `identifyObservedBody`
returns it as its own `collections` verdict. A key the game adds anywhere makes that identifier
refuse the body — which is right for a body of unknown provenance, and wrong for the app's own
request, where the route already says what it is. So `parseCollectionsState` is the looser of the
two: it ignores keys it does not know (and an effect on an axis the contract does not name), and
refuses only a missing required key, a wrong type or a figure out of range (a negative percentage, a
partial-page share above 100, a page holding more than eight pieces). `readCollectionsState` also
counts what it ignored. A body that parses but fails the identifier, or had anything ignored — an
unknown-axis effect passes the identifier — is kept and logged once as `read.drift`, so a change
the game makes degrades loudly instead of blanking the screen.

## Where it is read, and when

`apps/desktop/src/main/collections/` holds three objects, twinned on the PVP ones:

- the **reader** (`collections-reader.ts`, behind `collections:refresh`) asks for the route when the
  tab opens and on an explicit refresh, through the same consent gate, session token, transport and
  pacing as the account cycle. A refresh within ten seconds of the last is refused as
  `rate_limited`, and a refusal never blanks the screen;
- the **recorder** (`collections-recorder.ts`) takes a body from either the reader or the tap and
  is the one place that parses, stores and announces. A body that repeats the held one is still a
  read: it is re-dated and announced, so the date beside the book means "last confirmed", never
  "last changed". A body it cannot read stores nothing and keeps the last good snapshot;
- the **store** (`collections-store.ts`) keeps the parsed snapshot as JSON beside the account tables
  (`CREATE TABLE IF NOT EXISTS`, so `SCHEMA_VERSION` does not move). It holds one row per account,
  the account the session token names. A read the app asked for is stored under the account it
  asked as, even if the game has switched accounts before the body landed, and is announced only
  when that account is still the bound one. A body the tap saw carries no request, so it is stored
  under whichever account is bound as it passes. `collections:get` answers only from the bound
  account's row; a fixture run uses one reserved key no account id can equal, so it neither shows
  nor overwrites a real profile's row. A row that no longer reads as the contract's shape — or is
  out of range, since the parser's range check is the same one — is treated as absent.

The renderer reads `collections:get` once and follows `collections:changed`, both carrying a
`CollectionsView` (`{ snapshot, capturedAt }`, both `null` before any read landed).

## Offline mode

`pnpm dev:offline` answers `offline` to a refresh, since there is no server to ask; the replayed tap
serves the synthetic body once per tap, ahead of the first frame, through the same HTTP decoder the
capture's own bytes go through. The replay reads the one fixture the wire-reading package commits
rather than a second copy. `BFC_REPLAY_COLLECTIONS_FIXTURE` points the replay at another body; an
empty string serves none. See [`offline-dev-mode.md`](offline-dev-mode.md).
