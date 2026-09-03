# Use the width you have

**Status:** hard truth (visual)

A panel whose sections are stacked full-width rows, each carrying only a label and a number,
wastes most of the screen it is given. The Account holdings figure shipped that way once: three
bands, three short numbers, two thirds of every band empty.

It is now three rows again, and that is not a reversal. Each row spends its full width — a name,
the coverage behind it, its figure, and a disclosure holding that component's own entries — and
the panel itself gave up half the screen to sit beside the account facts. What was wrong before
was a band carrying a label and a number and nothing else; what is wrong is empty width, not
stacking.

The columns it wore in between failed for the reason rule 4 now states: at the widths this app is
actually used at, an auto-fitting grid wrapped its third column under its first, and a reader
could no longer tell which figure belonged to which name.

## Rules

1. **WHEN** sibling sections carry only a short label, a figure and a caption, **THEN** lay them
   out side by side rather than stacked — provided every one of them fits without wrapping.
2. Full-width rows are for content that needs the width — tables, prose, lists of many items.
   A row is not full-width because it is important; it is full-width because it is wide.
3. Side by side collapses to stacked at narrow widths. The desktop window is resizable down to a
   small measure and the planner is used on narrow viewports, so a fixed multi-column grid is as
   wrong as never using the width at all.
4. **A wrapping grid is worse than a stack.** Three columns that fold to two leave the third
   sitting under something it has nothing to do with, and the reader has to work out which figure
   belongs to which name. If a set cannot hold its columns at the widths the screen is really
   used at, give it one predictable shape at every width instead of a shape that depends on the
   window. Prefer `auto-fit` only where every wrapped arrangement still reads correctly.
5. **Side-by-side panels are the same height.** A panel that stops short of its neighbour, leaving
   a ragged step and a hole beneath it, reads as unfinished rather than as brief. Stretch the row
   and let the shorter panel fill it. The stretch has to reach the panel itself and not merely the
   cell around it — the panel is the thing carrying the border, so a stretched cell wrapping an
   unstretched panel looks exactly as wrong as no stretch at all.
6. A panel whose values are abbreviating is too narrow, whatever the layout says. Widen its track
   before accepting the ellipsis: the neighbour usually has the room to spare.
7. Empty space is not automatically a defect. Deliberate breathing room around a single headline
   figure, or a measure that stops prose growing past a readable line length, are both correct.
   The defect is *repeated* short rows each claiming a full width they do not use.

## Agents: report this, do not silently fix it

**This is a report-it rule.** Noticing that a screen wastes its width is a finding for the
maintainer, exactly like any other out-of-scope finding: say what is empty, propose the layout,
and wait for an answer. Rearranging a screen you were not asked to rearrange buries the change
you *were* asked for.

The exception is the ordinary one: if you are already rewriting that screen's layout, and the fix
is part of the work rather than a detour, do it and say you did.

## No guard enforces this

There is deliberately no lint rule and no test for it. No threshold can tell deliberate breathing
room from a wasted row — the same 60% empty space is right on a headline and wrong on the third
identical row beneath it. Review carries this one, which is why it is written down rather than
automated.
