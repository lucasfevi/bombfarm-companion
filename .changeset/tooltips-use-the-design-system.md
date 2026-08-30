---
"@bombfarm/game-art": patch
"@bombfarm/desktop": patch
---

Show the market price and refresh hints in the app's own tooltip instead of the browser's.

The Steam price figure and the per-item refresh control carried their explanation on the native
`title` attribute, which is OS chrome: unstyled, untouched by the app's theme, on a delay the
browser owns, and shown neither on touch nor on keyboard focus — so the quote's basis and age were
invisible to anyone not hovering a mouse. Both now use the design-system tooltip, which appears on
keyboard focus as well as hover. The price link keeps opening the listing in a new tab and stays
reachable by keyboard, and an untradable item still renders nothing at all.

Lint now rejects the native attribute on a DOM element across the design system, the game-art
package, the desktop renderer and the web planner, so the next one cannot land unnoticed.
