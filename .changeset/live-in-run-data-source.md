---
"@bombfarm/contracts": patch
"@bombfarm/domain": patch
"@bombfarm/desktop": patch
---

Add the in-run live data source, alongside the existing periodic account sync

Groundwork for reading a running game session's live combat stream, so field and recovery
countdowns can eventually be built from real, observed energy drain rather than only the modelled
rate. Countdowns now carry where their number came from, and a number derived from the modelled
rate is never presented as an observed measurement.

The app reports whether it is reading live data and, when it is not, distinguishes a gap it could
act on — never attached, permission not granted, the read went quiet — from one it cannot, such as
the game being closed or idle. Recovery countdowns advance only while the game world is actually
advancing, so they freeze rather than counting down through time that never happened. Revoking
permission for the live read takes effect immediately, tearing the attachment down before the
revoke is recorded.

The live read itself is not enabled in this release: no instrumentation runtime ships yet, so the
app runs in its no-live-data mode, serving the periodic account sync and labelling every countdown
as modelled. That path is a supported state, not a failure.
