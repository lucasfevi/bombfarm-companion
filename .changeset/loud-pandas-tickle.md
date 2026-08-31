---
'@bombfarm/desktop': patch
'@bombfarm/contracts': patch
'@bombfarm/ui': patch
---

Fix Settings → Updates claiming "Updates are off in this build" on installed Beta and stable
builds. Main answers the renderer's one status read before it has finished building the update
service, and that pre-service answer said `disabled` — a claim about the build rather than about
readiness, and one that greys out the check button that would otherwise disprove it. It now
reports the flavor's real capability, and the settled status is pushed once the service exists.

Add an update indicator to the desktop footer, left of the version. It appears when an update is
found, stays through the download, and ends on "Restart to update"; clicking it opens Settings →
Updates, where the controls already live.
