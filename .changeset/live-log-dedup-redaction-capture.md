---
"@bombfarm/desktop": patch
"@bombfarm/game-api": patch
"@bombfarm/contracts": patch
---

Live frames decode into the fields they were always meant to fill, and the desktop log stops
repeating itself

The live combat decoder read field names the game does not send. Measured against a real captured
session: across 381 frames it produced **zero** hero energy values, zero room-HP readings, and 336
hit entries with no damage on any of them — the wire sends `e`, `room_hp` and `d` where the decoder
read `energy`, `roomHp` and `amount`, and `gold` arrives as a string of digits that was being passed
straight into a number-typed field. Nothing errored, because frames decoded fine and carried the
expected message type; the live panel simply had nothing to show. The synthetic test fixture was
hand-written against the same assumed names, so it agreed with the decoder and both disagreed with
the game.

The wire vocabulary now lives in one lexicon beside the existing rotation one, so abbreviations are
translated to names that say what the value is — `heroes[].e` is an energy fraction, `heroes[].w` a
move speed, `hits[].d` damage — and the generated wire glossary covers both routes. Money is
coerced from its wire string and a malformed value is dropped rather than becoming `NaN`. A capture
from a real session is committed as a fixture, so this class of drift fails a test instead of
emptying a panel.

The shared desktop log gained two guarantees with no bypass: every record is redacted before it
reaches the transport, and repeated records collapse to one line plus an exact count. At ten frames
a second a single undeduplicated field-drop was 36,000 identical lines an hour; it is now one line
and a count. The session token can be scrubbed from any log record without the token type ever
handing its raw value to a caller. Rotation field drops that used to be discarded are now reported
once per field rather than once per hero affected.

Supporting this: a bounded in-memory ring of recent frames, dumped scrubbed on a decode failure, and
a dev-flavor-only raw capture behind an explicit flag. Both write local files beside the user data;
neither transmits anything. A decode failure no longer discards the good frames that shared a
network read with the corrupt one — previously all of them were lost, including the ones the crash
dump existed to preserve.

Settings gained a Diagnostics section with a "Save a bug report file" button, so a player can
trigger the same scrubbed dump on demand instead of only after a decode failure. A rate-limited or
failed write is reported as such, never as a silent success.
