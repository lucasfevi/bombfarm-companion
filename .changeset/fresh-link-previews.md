---
'@bombfarm/web': minor
---

Give every page its own link preview, and stop serving a stale one.

A shared link previewed as the planner no matter which page it pointed at, under a description
that predated the Farm board, Team plan, Inventory, Account and the Windows app — and above a
card image still carrying a product name the site had dropped. Two separate causes: a route that
overrides `title` alone still inherits its parent's whole `openGraph` object, so per-page
descriptions reached the browser tab and never the embed; and the card was a committed PNG whose
own source had been updated without anyone re-rendering it.

Now `/`, `/farm`, `/team-plan`, `/inventory`, `/account` and `/download` each carry their own
title, description, canonical URL and share card, all built from one copy file. The cards are
generated from that same file rather than hand-drawn, and a test fails if the copy changes
without a re-render. `/phases`, which only redirects, is no longer indexed, and the sitemap —
which had listed just the home page since the site had one page — is generated from the route
list instead of hand-maintained.

The brand orange is now one colour in the three places a shared link shows at once. The
`theme-color` that paints the embed's edge, and the favicon — which is also the logo in the app's
own header — had each drifted to a shade the design system no longer defines.
