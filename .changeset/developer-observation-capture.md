---
"@bombfarm/desktop": patch
---

Add a developer-only recording mode that writes every REST body and live frame the tap observes to
a newline-delimited JSON file, including the bodies the app cannot identify and otherwise discards.
The mode is unavailable in an installed build regardless of environment, and the session token
cannot reach the recording: every record is written through one serialiser that scrubs first, and
each line records whether value-level redaction was armed when it was written.

The raw frame capture that already lived beside it now also refuses to run in a packaged build,
rather than gating on the app flavor alone.
