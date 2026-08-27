---
"@bombfarm/desktop": patch
"@bombfarm/ui": patch
"@bombfarm/web": patch
---

Live screen and header polish from direct feedback on the running app

`AppShell` gains an optional `brand` slot, and the shared design system exports a `BrandMark` —
an inline rendering of the header mark's five shapes rather than a binary asset either app would
need its own copy step for. The desktop now shows it beside its title, matching the web's own
header mark.

The desktop's Live screen showed two vertical scrollbars: the real one on its hero lists, plus an
always-reserved empty gutter meant for the web's own page scroll. That gutter rule now lives only
in the web's stylesheet.

On the Live screen: hero avatars beside the three-line stacked identity are bigger, so the row
reads as one block instead of a small icon dwarfed by its own text. The dashed underline under
field/rest countdowns is gone from both the modelled and direct-reading states — the row already
never reflowed when the basis flips (that's what the shared underline was protecting), and the
text colour plus a screen-reader-only qualifier still carry the distinction. The standalone "Field
slots in use" panel is gone; its count now lives in the on-field list's own header, as a plain
`occupied/total` (or just `occupied` when the field size hasn't been sent). The on-field list
itself is renamed "Field" ("Campo"), the name the retired panel used.
