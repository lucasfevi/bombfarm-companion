---
"@bombfarm/desktop": minor
---

The Farm board's Refresh goes and reads the account, instead of re-solving over the one it already
had.

**It never asked for a read.** Pressing it took whatever the background account cycle had already
committed and re-solved the board from that. When the cycle had not run since the board last took
its copy, the press re-solved from identical inputs and produced the identical board. This was
harder to spot than the same defect on the Forge screen, because the press always did real work
and always showed a busy state — so a board re-solved over an account minutes old looked exactly
like one that had just gone and looked. Change a hero's gear in the game, press Refresh, and the
old answer came back with nothing to say why.

**Now the press asks main to read, and still re-solves either way.** The re-solve is not
conditional on the read being allowed: the board can be behind an account the app has already
committed even when no new read may start, and that case is fixed by re-solving alone. What the
read finds arrives afterwards and re-solves the board a second time.

**Every press ends in something the reader can see.** The button reads as working while either the
re-solve or the read is in flight, and takes no second press meanwhile. A press that started no
read says why, beside the button, where a line of any length leaves the button where the reader
last saw it: the account was just read a moment ago, no server behind this account, the account
read not accepted in Settings, the game not open, the game session unreadable, or the app still
starting. Both locales.

**One wording, one behaviour, for both screens.** The refusal lines and the press-to-settle
behaviour are now shared with the Forge screen's Refresh rather than written twice. Two of the
lines named the Forge's bag and now name the account, which is what both screens are actually
refreshing.
