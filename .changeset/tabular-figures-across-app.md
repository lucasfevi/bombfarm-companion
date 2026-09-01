---
"@bombfarm/desktop": minor
"@bombfarm/web": minor
"@bombfarm/ui": minor
---

Set the app in a face whose digits are all one width, so numbers stop jittering as they count

Every figure in the app re-flowed while it was on screen. The body face shipped no tabular
figures, which meant `1` rendered at barely half the width of `8` — measured at 20px, 6.56px
against 12.33px — and the ~105 places that asked for `font-variant-numeric: tabular-nums` got
nothing back, because a face without tabular figures has no such feature to switch on. Every
live reading therefore changed width as its own digits changed, dragging whatever sat beside it.

The body face is now IBM Plex Sans, whose digits are equal-width with no feature required, so
they hold still even where nothing asked. It is the superfamily of the mono face the app already
loaded, so the figures that are deliberately set in mono — the hero energy readings, the rest
countdowns — now sit beside their own sans rather than an unrelated one.

A face cannot fix the other half: no figure stops `9` becoming `10`. The Live screen's rotation
counts sat content-sized in a row, so a roster crossing nine heroes in one state widened that
badge and shoved the three beside it sideways. Each count now reserves a slot wide enough for
two digits, on the desktop Live screen and on the download page's replica of it.

The Live earnings panel's current-gold figure also sat 16px left of the five figures beside it.
Its staleness marker is always mounted — merely invisible while the reading is fresh, so that
showing it never resizes the tile — but it sat after the number and pushed it off the tile's right
edge. The marker now hangs to the number's left, the way the hero row's direction caret already
does.

Two notes on the new face. It tops out at weight 700, so the few `font-extrabold` and
`font-black` headings and hero-rank badges now render at bold rather than heavier. Link-preview
cards are regenerated in the new face by the same script that draws them.
