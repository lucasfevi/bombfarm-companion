---
"@bombfarm/contracts": minor
"@bombfarm/desktop": minor
"@bombfarm/web": minor
---

Ship the desktop app on a stable channel, and point the download page at it.

Merging a desktop version bump to `main` now publishes a public GitHub Release. It always looked
as though it did: the workflow packaged an installer, named itself after production, and logged a
successful run. What it actually did was gate the publish step on a repository variable nobody had
ever set, upload the installer as a CI artifact that expired after a day, and publish nothing —
165 times. The gate is gone. Whether to ship is decided by whether you merge the release PR, which
is the control that was always real.

The download page serves that stable build, and falls back to the newest beta when no stable build
exists — which was the case for the whole life of the page until now, and would be the case again
if stable publishing broke. The fallback is never silent: the chip beside the download button and
the line under it name the channel the page actually resolved, and the channel cards mark whichever
one is being served. Recognising a stable installer takes a little care, because it is the one
build electron-builder names without a channel word in it: `bombfarm-companion-0.7.0-setup.exe`
against beta's `bombfarm-companion-beta-0.7.0-beta.163-setup.exe`.

The nightly channel is withdrawn — the flavor, its packaging script, its scheduled workflow, its
release retention, and the card on the download page that promised builds "every night". It had
published no release in the life of the project and its schedule had been switched off to save CI
minutes, so nothing is installed on it and no update path breaks. `BFC_FLAVOR` now takes `dev`,
`beta` or `prod`, and rejects `nightly` rather than quietly accepting a flavor that no longer
builds.
