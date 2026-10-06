# Deconstruct — burning items for Forge Essence

The desktop Forge tab has a second page, **Deconstruct**. It lists every item in the bag and stash
that could be burned, lets the player filter and tick up to 100 of them, and burns the batch for
**Forge Essence**, the currency the forge spends. The game has the same screen with no filters; this
page keeps the game's rules and adds the filters. This doc is how the shipped code does it.

## The one write

A burn is one POST, built only by `buildWriteRequest` in
[`packages/game-api/src/write-request.ts`](../packages/game-api/src/write-request.ts) — the seventh
route that module knows (`WRITE_ROUTES.deconstruct`). The item ids travel in a single `items`
parameter, comma-joined (`&items=11,12,13`), beside the account id and the request id every write
carries. Before a header is built the call is checked: between 1 and 100 ids, every id all digits,
no duplicates. Anything else throws `InvalidWriteCallError` and nothing is sent.

The batch is **all or nothing**. The server either burns every item named or refuses the whole call,
so a refusal never leaves a half-burned batch to untangle. A refusal arrives as an API error code,
and [`deconstructRefusalReason`](../packages/domain/src/deconstruct.ts) names the ones the client
knows: equipped, locked by the player, on the market, holding gems, in the import cooldown, not
burnable at all, batch too big, and an item that no longer exists. A code it has no handling for
maps to `null`; the run still settles as `refused` with the code kept, and nothing is burned.

A refusal about an item is classified before any rate-limit reading of the body. The import cooldown
arrives as `ITEM_IMPORT_COOLDOWN`, which mentions a cooldown but is about that one item: it settles
as `refused`, shows the "came from Steam recently" line, and leaves the request pacing gate ready,
where a real rate limit would open a backoff that blocks every other account read and write. The
rule is by prefix — every code starting `ITEM_` is an item refusal — and a 429 or 503 status is a
rate limit whatever the body names.

## Who may write

The same gate as every other write, in order, in
[`deconstruct-service.ts`](../apps/desktop/src/main/deconstruct/deconstruct-service.ts):

1. the request is well-formed (`bad_request`);
2. no other write is running — one shared **writer lock** with the forge run and the Optimizer's
   apply run, so none of the three starts while another holds it (`busy`);
3. the account is a live read, not the offline fixture (`offline`);
4. every id is in the items the renderer is looking at (`unknown_item`);
5. consent is granted, the game is running and the session token reads (`not_consented`,
   `game_not_running`, `token_unavailable`);
6. the Settings switch "Let the app forge, equip and reset points" is on (`writes_disabled`).

The consent text names burning items for Forge Essence in its write clause, so a player who agreed
to the earlier wording is asked again once.

## Why the app never computes essence

How much essence an item yields is the server's number, carried on every item row as
`essence_value`. The page's totals are sums of those values (`deconstructBatchSummary`), and the
balance after a burn is the `essence` the server returns, not a running total kept here. A save
export or a body from before the screen existed has no `essence_value` at all; that reads as
"unknown" (`null`), never as zero, and an unknown piece of equipment is still offered while an
unknown anything-else is not.

Closed chests and hero cages burn too: the server prices each at its worst possible content, so a
chest is listed, tickable and counted like any other item once its `essence_value` is above zero.
Only what the server prices at zero, such as a skin pack, stays out of the list.

## Eligibility lives in the domain package

[`packages/domain/src/deconstruct.ts`](../packages/domain/src/deconstruct.ts) holds the rules the
page reads, so the filter, the tick boxes, the Fill button and the confirm warnings agree:

- `deconstructBlockReason` — why an item cannot be burned, checked in the order the client checks:
  a server verdict (`ritual.desconstruir: false`, with its own reason when it is one the client
  knows), then worth-burning, equipped, locked, on the market, socketed with gems, in the import
  cooldown.
- `deconstructBatchSummary` — count, essence, how many are forged, how many are Epic or rarer. The
  confirm always appears; the last two drive its warnings.
- `deconstructFillCandidates` — the game's autofill: burnable items below Rare, lowest rarity then
  lowest level first, up to the cap, **never a chest or a cage**. Their derived tiers sit low, so
  they would be swept in; the game burns them only when chosen explicitly, and so does this page —
  ticking one, or "Add all" on a list that shows it, adds it. The page applies Fill to the rows the
  filter shows.

The renderer treats these as a pre-filter. The main process does not re-check them; it checks the
ids are items the account holds, and the server's verdict stands.

## The cap

100 is the game client's own limit. `DECONSTRUCT_BATCH_MAX` is defined twice — in the contracts
package, which the request check and the request builder read, and in the domain package, which the
page reads — and a parity test fails if the two ever differ. The server may enforce a smaller one; a batch over it comes back as a
refusal, with nothing burned, and the player ticks fewer.

## The batch is checked again when Burn is pressed

The list is pinned so a row does not move under the pointer, which means the ticks can outlive what
the app's own live account data says. Pressing Burn therefore adopts the live read first, the same
adoption the refresh control makes, and prunes the ticks against it with the page's usual rule:
anything gone from the account, equipped, locked, on the market, socketed or in the import cooldown
leaves the batch. The confirm opens for what is left, and the hint under the batch says how many
left. If nothing is left the confirm does not open. The confirm also states how many of the ticked
items the current filters hide, since the batch is every tick whatever the list shows.

The ticks belong to one game account. When a read names a different account id from the last one the
page saw, the batch is emptied, the list adopts the new read at once and any shown result is
dismissed. A read that names no account changes nothing.

## The forge queue

A burn, a forge run and the Optimizer's apply run share one writer lock in the main process, so only
one write is ever in flight. The page reflects that rather than racing it: Burn is disabled while a
forge run or the forge queue is working, and the queue's Start is disabled while a burn is in
flight. The run store would pause a running queue if one started between the render and the confirm,
and resumes it when the burn settles; with Burn disabled, that branch covers only that race.

## One attempt, then a re-read

A burn destroys what it names, so it is made **once**. The request id is generated with the call
and nothing resends it: a network failure, a cooldown, an expired session and an unreadable reply
each settle the run as `failed` with the matching reason, and the player decides what to do next.

A 200 that carries the new balance means the batch burned, so a missing `queimados` count is read
as the batch size, and the account patch removes every requested id. This differs from the game's
own toast, which falls back to zero for a missing count; the app keeps its reading because the
patch has to remove the items the server just accepted. A missing gain reads as zero.

Whatever the outcome, the run ends the same way: if it burned, the account the app holds is patched
at once (the burned items removed, the balance replaced —
[`deconstruct-account-patch.ts`](../apps/desktop/src/main/deconstruct/deconstruct-account-patch.ts)),
an immediate account re-read is requested so the truth replaces the patch, the writer lock is
released and one `done` event is pushed to the renderer. A failed or refused run skips the patch but
not the re-read — after a network failure nobody knows whether the server acted.

## Offline mode and fixtures

The offline fixture account is refused (`offline`), so the page can be looked at under
`pnpm dev:offline` but a burn cannot be started from it. A smoke-only injector replays a scripted
result through the same event channel and is honoured only where the forge's own injector is.

The essence values, forge counters and scroll prices in the committed fixtures are **synthetic**:
shaped after a live read, never the game's own numbers (the offline generator states how). Do not
read a figure off them. The offline account carries closed chests and hero cages with a positive
value so the page has some to show.

## The batch panel

The panel beside the list reads top to bottom: the title with a line saying burnt items do not come
back, the four figures, the tiles, a table of what the batch holds, the hint and the three buttons.

- **Tiles.** One square per ticked item, with a bare ✕ over the top-right corner that takes it back
  out. The mark overhangs the tile, so the grid is padded and spaced by that overhang rather than
  letting the scroll region clip it.
- **The group table.** One row per kind and rarity ("Epic Keys 80"), most numerous first.
  A chest or cage is grouped by the name it prints instead ("Item chest · Lv 80", "Hero cage · Act
  5"). The label is one template per language, so Portuguese puts the kind first ("Chaves · Épico")
  and never has to agree a rarity with a noun's gender. The table is the panel's one flexible
  neighbour of the tiles: it takes the height its rows need, up to six rows, then scrolls on its
  own, and the tile region absorbs the difference, so Burn stays where it is as rows come and go.
  An empty batch leaves only the rule above the table.
- **Confirm.** The forged and Epic-or-rarer warnings are printed by the confirm dialog alone, where
  the game prints them.
