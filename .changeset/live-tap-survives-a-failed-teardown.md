---
"@bombfarm/desktop": patch
---

Re-granting consent brings the live tap back even if a previous teardown failed

Forcing the tap down stopped the old one and then replaced it. If the stop threw — which it can,
when an attach is in flight and the instrumentation runtime fails to resolve at that moment — the
replacement never happened, leaving the live source holding a tap whose poll loop was permanently
stopped. Every later wake-up returned immediately, so re-granting consent produced nothing: the
live panel stayed empty until the app was restarted, with only a log line to say why. The
replacement now happens on both paths, while the failure itself still surfaces.

Separately, decoding a network read no longer recurses once per malformed frame or once per HTTP
response inside it. Recovering from a bad frame had been made to hand the rest of the read back to
the frame-boundary resync, and reading back-to-back HTTP responses had always called itself — both
grew the call stack in step with what a single read happened to contain, so a large enough one
would have crashed the app outright. Both now iterate.
