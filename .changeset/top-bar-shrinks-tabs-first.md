---
"@bombfarm/desktop": minor
"@bombfarm/ui": minor
---

The top bar gives up its tab words before it gives up a control, and its content sits on the same
measure as the panels under it.

**The order it degrades in is reversed.** A narrowing window used to collapse Open mini, the
referral chip, the coffee link and the PT/EN toggle into one overflow button first, and keep every
tab spelled out well past that. That was backwards: a tab word stands in for a glyph the player
learns once and then reads at a glance, while an action behind a menu costs a click every single
time it is used. Now the tabs drop to glyphs first, then the brand lockup drops to its mark, and
the actions are the last thing to collapse.

**At the smallest window the app can be dragged to, every action is still its own control.** That
window — 960px, less the strip the OS caption buttons take — used to sit in the collapsed shape.
It now sits one stage above it, with glyph tabs, the brand mark, and all five actions in the bar;
the overflow button appears only below the app's own minimum, which is where the shape was always
meant to be a floor rather than something a player meets. Each stage's width was re-measured off
the rendered bar in Portuguese, the language whose words are longest.

**The bar and the status strip line up with the content.** Both were full-bleed, so on a wide
window the brand and the version line stood in the window's corners while the panels were inset by
the measure's gutter. Both now draw their content on the content measure, keeping their border and
background across the full window, and all three reserve the same strip for the one scrollbar — so
the top bar starts exactly where the panels start. The content region also holds that scrollbar's
gutter open permanently, so a panel that grows past the window height no longer narrows the page
as its scrollbar appears.

**The Forge screen fills the window.** Its bag was sized by the column of panels beside it and
nothing else, so on a tall window the screen stopped where that column stopped — a 1400px-tall
window drew a 460px bag and then ~600px of empty background above the run ledger. The bag row is
now the screen's slack: it takes whatever height the toolbar, the run band and the ledger leave,
so a taller window reads more of the bag instead of more background. The give stays
one-directional — a window too short for the piece and the plan lets the page scroll rather than
squeezing the bag under them — and opening the run ledger takes its room from the bag's spare
height first, moving nothing above it.
