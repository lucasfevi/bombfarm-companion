---
"@bombfarm/desktop": minor
"@bombfarm/domain": minor
"@bombfarm/ui": minor
"@bombfarm/web": patch
---

Add the referral code to the desktop app, in the two shapes the support link already uses: a chip
in the top bar beside the language toggle, and a labelled row in the Settings support section.
Clicking either copies the code; when the clipboard is refused the code is selected in place and
the app says so, so the click always leaves something to act on.

The code itself moves to `@bombfarm/domain/referral`, which the web planner's topbar chip, footer
line and first-run notice now read through as well. It had been a web-only constant, and this code
does change — a desktop copy updated separately would eventually show a dead code that a player
pastes and loses the reward on.

`@bombfarm/ui` gains the `copy` icon and a `referral` button variant that both apps' controls can
draw from.
