# Use the width you have

**Status:** hard truth (visual)

A panel whose sections are stacked full-width rows, each carrying only a label and a number,
wastes most of the screen it is given. The Account holdings figure shipped exactly that way:
three rows, three short numbers, and roughly two thirds of every row empty.

## Rules

1. **WHEN** sibling sections carry only a short label, a figure and a caption, **THEN** lay them
   out side by side rather than stacked.
2. Full-width rows are for content that needs the width — tables, prose, lists of many items.
   A row is not full-width because it is important; it is full-width because it is wide.
3. Side by side collapses to stacked at narrow widths. The desktop window is resizable down to a
   small measure and the planner is used on narrow viewports, so a fixed multi-column grid is as
   wrong as never using the width at all.
4. Empty space is not automatically a defect. Deliberate breathing room around a single headline
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
