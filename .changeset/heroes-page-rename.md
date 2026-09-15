---
"@bombfarm/web": minor
"@bombfarm/farm": patch
---

Rename the Planner page to **Heroes**, and its URL from `/planner` to `/heroes`.

"Planner" was the name of the whole site before it grew a Farm board, an Optimizer, an Inventory and an Account page; as one tab among six it named nothing in particular. The page is the per-hero workspace — the roster rail, and the Hero, Gear, Points and Combat tabs for the hero you pick — and "Heroes" is what the desktop app has always called the same screen. In Portuguese it is **Heróis**.

`/planner` keeps working. It is a redirect stub that replaces itself with `/heroes` — the same shape `/phases` and `/team-plan` have used since their renames — so a link shared before today still lands, is not indexed, and does not trap the Back button. The page's share card is re-rendered under its new name.

The Farm board's empty-roster note no longer sends you "to the Planner": it says to import heroes, and the link beside it names the page — so the shared copy stays true on the desktop app, which reads the account from the game and has nothing to import.
