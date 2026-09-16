---
"@bombfarm/desktop": minor
"@bombfarm/contracts": minor
"@bombfarm/game-api": minor
"@bombfarm/ui": patch
---

PVP tab: a history of every duel fought while the app was open.

**A new tab, between Optimizer and Account.** The nav now reads Live · Farm · Heroes · Inventory ·
Forge · Optimizer · PVP · Account · Settings. When a duel settles, the app keeps what the game
reported — when, the opponent and how many heroes they fielded, won or lost, both scores, the room
phase against your tier's floor, the points before and after, and whether the rune chest landed
or was lost to a full bag — and lists it newest first. Nothing is predicted and no squad is picked.

**Your standing sits above the list**, asked for the moment the tab opens: tier, points over the
next tier's threshold, duels left today, squad slots, and your position on the points
leaderboard. **The list filters by opponent and by result**, and with an opponent chosen prints
your record against them.

**The film is kept the moment the game fetches it.** The server drops a duel's film seconds after
the client pulls it, so the app keeps the body as it passes; the list says which duels have theirs.
A duel whose film never arrived — the battle was skipped, the server issued none, or the app missed
it — is still listed.

**The top bar gives up its words a little sooner.** A ninth tab makes the worded strip about 52px
wider and the glyph strip 36px wider, so all three widths the bar degrades at moved with it. The
smallest window a player can drag to still draws every tab and the brand mark.

Offline mode (`pnpm dev:offline`) serves two fixture duels, one with its film and one without, so
the tab can be looked at without a game.

**The live tap now reads chunked and compressed responses.** Until now it skipped both shapes,
and the first duel fought against this tab left only skipped bodies in the log; anything the game
sends chunked or gzipped is read from here on, up to 8 MiB a body.
