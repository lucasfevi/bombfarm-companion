---
"@bombfarm/desktop": minor
---

See the whole roster at once, as a board of cards.

The Heroes screen has a view toggle above it — the Inventory's own pair of glyphs, for the same
two shapes. The list stays what it always was: names down one side, detail beside them. The board
is the other way of looking at the same roster, every hero as a card, all of them on screen.

**What a card shows.** The hero's identity and roll quality, then the three things you compare a
roster on and cannot see from a list: its birth roll as eight tinted bars, one per statistic,
showing where each landed inside its own band; its ability pool, each icon with the level it sits
at out of twenty; and its gear, each piece with its item level and forge upgrade. Its power sits
under the roll, compact the way gold is — `617.210` reads `617.2k`. The exact reading behind every
bar is on the bar's own tooltip, so the compact form loses nothing.

A hero you have taken out of the rotation is greyed rather than hidden, so it can still be
compared against the ones that are in. The three groups wrap at four, three and four rather than
filling the width, and a card is exactly as wide as the gear row it holds — so the board fits as
many as the window has room for rather than stretching a fixed few, six across at 1500px. Gear
sits on the floor of every card, so it lines up across a row whatever height the abilities above
it took.

**One toolbar orders and narrows both presentations.** Sort by birth roll, power, level,
rarity, grade or stars, either way up — the Inventory's own sort control, a key and a direction
sharing one outline. A hero whose figure the account has not carried sorts last in both
directions rather than ranking as the weakest on the roster. Beside it, every ability in the game
as a row of icons: press one to keep only the heroes that own it. The ones no hero here owns are
dimmed and cannot be pressed, which is itself the answer to "which of these do I have none of".
And one switch keeps only the heroes that are active.

All of it applies to the list as well as the board — they are two shapes of one roster, so
switching between them never changes which heroes are on screen. The list greys a shelved hero
the way the board and the picker already do. Which hero the detail is about never moves: a filter
is a question about the roster, not a hero switch, so a hero filtered off the list still holds the
panel beside it.

**Picking a hero from the board opens it.** The board fills the screen, so the detail is not
beside it — clicking a card selects that hero and returns you to the list, where the detail is.
Picking from the list does what it always did and leaves you where you are.

The switch is animated, and the cards arrive in order rather than all at once. A reader who has
asked their system for reduced motion gets neither.
