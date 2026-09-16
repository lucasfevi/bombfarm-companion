---
"@bombfarm/ui": minor
"@bombfarm/web": patch
"@bombfarm/desktop": patch
---

The number spinner and the toast system no longer bake in English. `Num` takes
`incrementLabel`/`decrementLabel`, and `ToastProvider` takes a `labels` set (the dismiss button,
the overflow toggle and the progress readout), each passed by the host from its own dictionary — so
a screen reader on a localised screen no longer hears "Increment", "Decrement" or "Dismiss" in the
middle of an otherwise translated interface. The web planner's level stepper now passes its own
localised labels. A new guard in `@bombfarm/ui` fails on the next user-facing string baked into a
design-system component, and the desktop's pinned-exception list for design-system strings is
updated to match.
