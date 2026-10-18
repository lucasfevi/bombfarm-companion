---
"@bombfarm/desktop": patch
---

Adding an Optimizer plan to the forge queue no longer lowers a piece you already queued higher. Queue some pieces to +14, switch the forge floor to +13 and queue again, and the +14 pieces stay at +14 instead of dropping to +13. Pressing Add to queue on a single piece still sets its target exactly.
