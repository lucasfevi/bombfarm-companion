---
"@bombfarm/game-api": patch
---

Shape account-scoped requests the way the game client does. `account_id` now travels as the first
query parameter on every read and forge route, and the `X-Account-Id` header is gone. The game
sends only `Authorization`, `Accept`, `Host` and `Connection`, and carries the account in the query
on every route — the server cross-checks it against the account the bearer token resolves to, which
is what its `WRONG_ACCOUNT` error reports. Both request builders now assert their complete header
set rather than individual headers, so a future addition cannot slip in unnoticed.
