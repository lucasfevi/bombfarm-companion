---
"@bombfarm/game-api": patch
"@bombfarm/desktop": patch
---

Stamp forge writes with an idempotency key, the same one the game client uses:
`request_id=c<uptime ms>-<sequence>-<random 0..999999>`. The game sends one on every POST and
reuses it when it re-sends, which is what lets the server discard a duplicate rather than charge
for it twice. A forge roll spends real currency, so a write that is ever retried must carry the id
it was built with rather than a fresh one — the key is generated once per roll, and the sequence
is monotonic for the life of the service.
