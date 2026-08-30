---
"@bombfarm/desktop": patch
"@bombfarm/ui": patch
"@bombfarm/web": patch
"@bombfarm/contracts": patch
---

The Live tab now shows an Earnings panel above the heroes panel: the current gold balance (with the
in-game coin), gold rates for the last few minutes and the whole session, and the quieter XP
counterparts of both — one row of figures divided by thin rules, rather than a table. Every rate
the app has not measured yet reads as a dash, never a zero, and the session control that used to
read "Reset session" is now an icon button with the same accessible name.

The compact number formatter (`90200` → `90.2k`) moved from the web planner into the shared design
system so the desktop panel renders the exact same figures the web planner does — the web planner's
own import path is unchanged.

With the game closed and no live tick ever arriving, the current-gold cell now falls back to the
most recently stored account reading instead of showing a dash, with its age shown alongside it —
the same posture the panel already took for a balance that went stale mid-session. No new request
is made to refresh it; the displayed age simply grows while the game stays closed.

The panel has since been redesigned again: a single bordered headline band up top carries the
dominant gold-per-hour figure and a smaller XP-per-hour figure beside it on a shared text baseline,
with a context line underneath stating the true coverage of the recent window and the session
average rate, plus the reset control. Below the band, a reflowing grid of six tiles covers current
gold, elapsed session time, and both currencies' session totals and session rates. The two session
totals (`goldSessionTotal`/`xpSessionTotal` on `LiveEarnings`) are newly published by the live fold
— they were already tracked internally to compute the session rates, but never reached the
renderer before this change. Like every other figure on the panel, a total reads as a dash rather
than a zero before the session has anything to report, and is unaffected by the unrelated
10-minute rolling window's own eviction.

The very first account read after launch no longer waits out the full scheduled cadence: the app
now starts a read the moment the game is detected as running, instead of only on the next
scheduled cycle, so the waiting state on the Live tab clears sooner when the game was already open
at boot. That waiting state itself is also friendlier while it lasts — its sprite now renders at
twice the size, and a small rotating line of flavour text sits beneath it whenever a read is
genuinely in progress (never while consent is what is actually blocking), in both English and
Portuguese, and holding still under reduced motion.

The panel's chrome is quieter still: the visible "Earnings" title is gone (the landmark keeps the
same name for screen readers, carried on the panel itself instead of a heading), and the reset
control dropped its button outline and padding, now showing as a slightly larger bare icon that
still focuses and announces itself like any other button. Every live figure — both headline rates,
the session-average line, and all six tiles below — now sits in a box reserved for its widest
realistic form, so a rate ticking up through the compact-number ranges no longer nudges anything
beside it. The XP figure's old "?" control, which opened a click popover while also showing the
browser's own native tooltip underneath it, is gone; the "xp / hr" label itself is now the trigger,
underlined with dots, opening the same explanation on hover or keyboard focus, with no native
tooltip left to compete with it.

The current-gold tile's age suffix now stays hidden while a reading is under a minute old, instead
of printing a "just now" that told the player nothing. Past that threshold it still reserves its
own space so its arrival never nudges the balance beside it.

Every tile's value is now right-aligned to the tile's own edge, matching the left-aligned label
above it — previously the values sat in a fixed-width box that made them look inconsistently
placed from tile to tile. A rate tile's unit stays glued to its digits rather than drifting to the
tile's far edge on its own.

The Live tab now gives the earnings panel half the page width, sitting at the top of the tab in the
first column of a two-column area — the other column is left empty for a companion panel to land in
later, without the earnings panel itself needing to change. Its six tiles moved from a loosely
reflowing row onto a fixed three-column grid, giving two even rows of three instead of a stretch of
tiles that could all land on one line on a wide window; on a narrower window the tiles settle into
two columns instead of crowding three into too little space. The heroes panel below keeps spanning
the full width of the tab.

The reset icon has grown one size further, still a bare, real button with no border or background.

Three more presentation fixes, now that the earnings panel only spans half the tab width. The
current-gold tile's age no longer shares a line with the balance — it sits on its own reserved line
beneath the number, hidden until the reading is genuinely stale, and the balance itself is now
sized exactly like every other tile's value instead of reserving room for a trailing age that used
to overflow the narrower tile. All six tiles keep the same height regardless, since every tile
reserves that second line whether or not it ever has anything to show there.

The headline band's context line no longer repeats the session-average rate — the dedicated session
gold-rate tile below already says it, so the line now states only the recent window's coverage. That
line's left edge now lines up with the gold-per-hour figure above it, and the whole band reads
noticeably more compact with the redundant figure gone.

In the heroes list, every hero's energy bar now starts and ends at the same horizontal position on
every row: the hero identity block, the bar itself, the percentage reading, and the countdown
column all sit in one fixed set of grid columns shared by every row, so two heroes at the same
energy level draw fills of the same length instead of one looking further along than the other
purely because its name or countdown differed in width.

The earnings panel is restructured again, into two halves side by side split by a thin vertical
rule. The left half is a single right-aligned stack: the coverage line, the gold-per-hour figure
with its unit on its own line below, then the XP-per-hour figure the same way, with the XP unit
line still carrying the hover/focus explanation it always has. The right half drops the bordered
tiles entirely — its six figures now sit as plain label-over-value pairs, both right-aligned, laid
out three per row across two rows (current gold, session gold rate, session gold total; elapsed,
session XP rate, session XP total), with spacing alone doing the separating. The two session-rate
values dropped their trailing per-hour suffix, since the label above each one already carries it;
the two session-total labels were reworded to read unmistakably as totals rather than rates sitting
right next to them. The current-gold reading's age now sits inline beside the balance instead of on
its own line beneath it, still reserving its own space so its appearance never nudges the balance
it sits next to. The left half's own width is reserved against both languages' unit strings at
once, not just whichever is active, so the vertical rule cannot shift when the display language
changes.

The right half's six figures now sit on fixed-width columns instead of the fractional ones that let
a longer Portuguese label push a column wider than its English counterpart. Every label is a single
line now — none of the six may wrap onto a second line any more, so the columns can stay this
narrow in both languages without one clipping or nudging its neighbours. The current-gold reading's
age moved back off the value line and onto its own third line beneath it, and every one of the six
figures — not only current gold — now reserves that same third line, so both rows of the grid stay
exactly as tall whether or not an age is showing anywhere in them. The gold- and XP-rate labels
dropped "session" (the grid's own rows and columns already say as much) and the two total labels
lost "da sessão"/their trailing repeat of it, so all six fit their fixed column comfortably in both
languages.
