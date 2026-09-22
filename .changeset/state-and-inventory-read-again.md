---
"@bombfarm/domain": patch
"@bombfarm/game-api": patch
---

The account and inventory reads work again. Both are identified by their complete set of keys, so a single key the game adds is enough to make the app reject the whole body and read nothing from it — and that is what had happened: the account body gained a rune stash alongside timed hero runes, and inventory items gained a countdown that appears only while a freshly acquired item cannot yet be exported. Measured over a six-hour session, every one of 1,005 account bodies and 1,125 inventory bodies was being discarded, while the roster and rotation reads were unaffected. Both keys are now declared — the rune stash as required, since every observed body carries it, and the export countdown as optional, since the game emits it only while the lock is running, exactly as the hero level already declares the same key.
