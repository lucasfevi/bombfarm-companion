---
"@bombfarm/desktop": patch
---

A corrupt live frame no longer takes the good frames sharing its network read down with it

A single TLS read routinely carries several combat frames. When one of them failed to decode, the
frames already decoded ahead of it were delivered, but every remaining byte of that read was thrown
away — including whole valid frames that had already arrived behind the corrupt one. The loss was
silent: the live panel just missed a beat, and a diagnostics dump came back missing frames it
should have held.

Measured on the committed synthetic stream at a 4 KiB chunk size, 32 of 34 frames decoded. The two
casualties were the frame sitting entirely inside the discarded remainder and the one straddling
the chunk boundary. The decode failure now carries those unconsumed bytes with it, so they reach
the same frame-boundary resync scan that already recovers the rest of the connection. The same
fixture now decodes 33 of 34 — the deliberately malformed frame is the only loss, which is the most
any decoder can do.
