---
"@bombfarm/ui": minor
"@bombfarm/desktop": minor
"@bombfarm/web": patch
---

A long climb reads as a rolling window rather than a crowded line, and the stepper's glyphs sit
where they belong.

**The run chart is a rolling window.** It used to fit the whole run into a fixed drawing, so a
91-roll climb crowded its marks until they touched while the marks and the axis numbers stayed
sized for a run of ten. It now shows the most recent attempts only: one arrives, the oldest drops
off, and the line enters the window at the level the piece stood on before the window's first
attempt, so the first segment is a real transition rather than a gap. It is the same stepped line
and the same coloured marks at ninety rolls as at nine — nothing switches to a different drawing
when the run gets long.

**How many attempts it holds is a reading of the screen.** The chart measures its own width and
gives every attempt at least 12px of it, between a floor of 24 and a ceiling of 90. At the app's
smallest window that is 45 attempts; at 1920 it is 74, and it re-measures as the window is
dragged. The marks and the line scale with what the window holds — full, the dots are small and
the line is hairline; on a short run they are as big as they ever were. The axis is labelled with
the real attempt numbers of the window (`50 60 70 80 90`, not `0` to `45`), spaced so the labels
cannot collide however narrow the chart is drawn.

**The recent-rolls strip is gone.** The row of coloured dots under the chart drew exactly the
attempts the window now shows, so it was drawing them twice. The space goes back to the chart.

**The stepper's `−` and `+` sat low in their buttons.** Both glyphs are drawn on the maths axis,
which is above the middle of the font's own box, so centring the line box left them 1.5px low in
a 24px button — measured, not eyeballed. The buttons now centre their content explicitly and
lift the glyph by the difference, in `em` so it holds at any size. This is the shared control, so
the web planner's steppers are fixed by the same change.

**The Forge target reads at the size of the decision it is.** `Target` and its `+14` were a step
smaller than the figures below them, on the panel where that number is the one thing a player
sets. Both go up a step; the value slot is measured in its own type size, so it still fits.
