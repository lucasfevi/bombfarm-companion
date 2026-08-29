---
"@bombfarm/contracts": minor
"@bombfarm/desktop": minor
"@bombfarm/ui": patch
---

Update the desktop app from its own release channel, from a new Settings section.

Installed builds now check for a new version shortly after launch and every six hours they stay
open, and Settings gains an Updates section that reports what they found: the installed version
and its channel, whether one is available, download progress, and a restart-and-install action
once it is ready. A check button covers the time in between.

Nothing downloads without being asked. Finding a version announces it and stops there, so a
player on a metered connection chooses when to spend the bandwidth. The download is
resumable-by-retry rather than resumable: a failed one starts over.

Each installed flavor follows its own channel — Nightly, Beta, and stable never offer each other's
builds. A local development build has no channel and no installer to replace, so the section says
so plainly instead of showing a control that would do nothing.

Failures arrive as one of four reasons — unreachable server, rate limit, no published release,
or unknown — each translated in both languages, rather than the updater's own English text
reaching the screen.

Settings rows can now hold a read-only value in their control column (`data-settings-value`),
alongside the equivalents the Account and math-check stacks already had.
