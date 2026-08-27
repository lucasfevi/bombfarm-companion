---
"@bombfarm/ui": minor
"@bombfarm/desktop": minor
"@bombfarm/web": patch
---

The desktop app's shell now uses the same sticky top-bar shape as the web planner — a brand
lockup, a segmented Live/Planning/Settings pill, and a right-hand actions area — instead of its
former left icon rail. The desktop's PT/EN language switch moved from Settings-only into that top
bar (Settings keeps its own control too; both stay in sync), and the nav no longer carries icons.

The web's segmented nav pill and its bordered PT/EN toggle are extracted into two new shared
`@bombfarm/ui` primitives, `AppNav` and `SegmentedToggle`, so both apps render identical chrome
from one implementation. The web's own header keeps its exact appearance and behavior; only its
internals now call the shared primitives.
