---
"@bombfarm/web": minor
---

Rename the Team plan page to **Optimizer**, and its URL from `/team-plan` to `/optimizer`.

The page stopped being about one thing when it gained a farm objective: it now searches for gold per hour or for combined DPS, at a phase you choose, moving gear or points or both. "Team plan" named the artifact it produces rather than what it does, and "Optimizer" is what the Farm board's own button has always called it.

`/team-plan` keeps working. It is a redirect stub that replaces itself with `/optimizer` — the same shape `/phases` has used since the Farm rename, so a link shared before today still lands, is not indexed, and does not trap the Back button.

The output is still a team plan: the button still says Build team plan, and the results section is still named for the plan it produced. What changed is the name of the tool, not the name of the thing it builds.
