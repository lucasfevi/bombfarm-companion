---
"@bombfarm/desktop": patch
---

The live tap no longer loses a duel — or any response — to a connection it attached to mid-body.

**A PVP duel fought while the app was hooked could leave the PVP tab empty**, with nothing in the
log to say why. The tap keys what it knows about each game connection on an address the client
reuses as soon as it closes one, and it only recognised a response at the very front of a
connection's bytes: attach while a body was still streaming, or have the client abandon a body by
closing, and every later response on that connection — or on the next one at the same address —
was buried behind the leftover, silently, until the connection was given up on. The `/pvp/state`
poll came through a clean connection; the duel result a second later, and its film, did not.

The tap now scans forward for the next complete response header and resumes there, the same way
it already re-finds a combat frame mid-stream, and says so in the log with the number of bytes it
discarded. Giving up on a connection is logged too, and no longer happens while a later response
can be resumed from.
