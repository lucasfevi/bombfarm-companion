---
"@bombfarm/account": minor
"@bombfarm/desktop": minor
"@bombfarm/domain": minor
"@bombfarm/pricing": minor
"@bombfarm/web": minor
"@bombfarm/ui": patch
---

Answer the question both apps could only half answer: what is this account actually worth?

**A new figure — what this account could sell.** It adds up three things the market will take off
your hands: the tradable items in your bag, the heroes the game permits selling, and the bought
skins your heroes are wearing. Each is broken out on its own line with its own count, so you can
see at a glance that, say, forty of forty-three tradable items are priced and two of six sellable
heroes are. It appears on the Account page of the web planner and on the desktop app's new Account
screen, and it is the same computation on both — the two cannot disagree about the same bag.

Two things about that number are stated where you read it, because both would otherwise mislead.
A hero listing is priced by rarity alone — level, gear and abilities count for nothing on the
market — so the heroes line is a floor, never what a well built hero fetches. And a bought skin is
an account-wide unlock: it counts once however many heroes wear it, and only while one of them
still does, so dressing every hero back to a birth skin drops the figure with nothing sold.

**It never guesses at a part it cannot see.** When one of the three cannot be read at all, that
line says so instead of showing zero, and the heading changes to say the total covers only part of
the account. A missing part is never quietly counted as nothing.

**The desktop app has an Account screen.** It shows who the account belongs to and how far it has
come, the House — its recovery cycle and how many heroes it refills at once, with the next House
previewed at the level you get on unlocking it — the full skill tree as the game totals it, and
the sell figure above. The tab sits between Inventory and Settings, so the nav now reads
Live · Farm · Inventory · Account · Settings.

**The bag's own total is now named for what it is.** The header that read "Market value" on the
Inventory screen of both apps now reads "What your bag could sell". It was never the account's
worth — it was always the bag's, and now that the account has a figure of its own the old title
was the wrong one on the wrong screen. The number itself is unchanged, and it is now taken from
the same shared computation the Account screen uses.

**On the web planner, heroes are counted only after a fresh import.** Whether a hero may be sold
is something the game says in your save, and the planner has only just started carrying it. A
roster imported before this change does not have that answer, so the heroes line is withheld —
rather than reporting a whole roster as unsellable, which is what assuming an answer would do.
Import a save again and the line fills in. The bag and skins lines need no re-import.
