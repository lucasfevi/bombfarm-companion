---
"@bombfarm/web": patch
---

Say which way each hero's energy is going, beside the reading that never said.

The Live hero list printed a percentage and a bar, and a row at 43% looked the same whether the
hero was spending that energy on the field or recovering it in the House — the state dot said
which list the hero was in, but nothing tied that to the direction the number was travelling.

Every row whose energy is moving now carries a small caret in front of its reading: red and
pointing down while it drains, green and pointing up while it fills, nothing at all for a hero
whose energy is holding still. The direction comes from the row's own state rather than from
comparing consecutive readings — energy moves a whole percent every few seconds while the live
stream republishes four times a second, so a marker fed by the difference between two frames
would read "steady" through most of the drain it was drawn to report.

Colour is never the only signal: the glyph carries the same fact, and each marked row announces
"rising" or "falling" to a screen reader. The download page's drawing of the Live screen gains
the same marker.
