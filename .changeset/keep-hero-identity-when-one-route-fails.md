---
"@bombfarm/game-api": patch
"@bombfarm/desktop": patch
---

Stop the Live tab losing every hero's name and portrait after a long session.

Left running overnight, the hero list would eventually redraw as raw account ids under the default
portrait, with no rank letter, and stay that way until the game was restarted. Three separate
things had to be true for that, and all three are fixed here.

The identity a hero row shows — name, rank, rarity, stars, portrait — is not in the rotation feed
that drives the list. It is joined onto it from the roster, which is read on its own request, and
the app holds the last roster it read so that the live stream (which carries no roster at all) has
something to join against. That held roster was being replaced by whatever the newest cycle
carried, including nothing: the five requests behind one cycle fail independently, and the roster
is read *before* the rotation, so a cycle that lost only the roster still committed a rotation
body and blanked the join on its way past. Every later frame then re-joined against the emptied
roster, so one lost request cost every name until some later cycle happened to read a roster
again. The held roster is now kept unless a cycle actually read one, which is the same stickiness
the account-wide multipliers beside it already had.

Nothing reported any of this while it happened. A join that named nobody was silent — every
identity field is optional, so the result was a structurally valid, entirely nameless snapshot —
and a request that failed was silent too, so a cycle that lost one of its five and committed the
other four logged exactly what a clean cycle logged. A failed section is now named in the log with
its reason, and a join that resolved no identity at all is reported once for the join rather than
once per hero.

Underneath both: the roster had no stored last-known-good to fall back on. Sections were only
written to storage when they arrived perfectly intact, so a game update that merely *adds* a field
the app does not know yet — as one recently did to heroes and inventory items — quietly stopped
those two sections from ever being stored again. They still displayed, because a body that lost
nothing is served as it arrives; but nothing was kept, so the moment a live read failed there was
no older copy behind it, and with the game closed there was nothing to show at all. Storage now
keeps a section whose body lost no field, which is the same test already used to decide whether
that body is fit to display — a section good enough to show is a section good enough to keep.
