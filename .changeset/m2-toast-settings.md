---
"@bombfarm/ui": minor
---

Adds the toast system DESIGN_SYSTEM.md §11 specifies: a pure, node-testable queue reducer (`toast-queue.ts`) implementing key-based coalescing, a 3-visible/"+N more" overflow stack, severity-dependent auto-dismiss, and threshold-gated progress announcements, plus `ToastProvider`/`useToast`/`ToastViewport`/`ToastItem` built on a plain portal (base-ui's `Toast` couples every rendered toast to its own internal store and timers, which would fight this feature's single-source-of-truth reducer — see `design.md`'s T1 finding). Also adds `NotificationCenter` (a controlled ring-buffer view), `Slider` (a `@base-ui/react/slider` wrap), and the `SettingsSection`/`SettingsRow`/`SaveBar` settings-form primitives.

The legacy `Toast` stays byte-compatible for `apps/web`'s planner and now carries a `@deprecated` JSDoc pointing at `useToast`. `toast.recipe.ts` is untouched.
