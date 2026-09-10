---
"@bombfarm/web": patch
"@bombfarm/ui": patch
---

Wake one planner panel at a time again, and commit once per edit instead of twice.

Moving the panels into a shared package left their hosts holding the subscriptions on their behalf, so a store change re-rendered the hero strip and every sibling tab alongside the panel that actually read it. Each panel now has its own connector, which subscribes to exactly what that panel needs.

The same move also cost the design system's Select its stable option list: it handed Base UI a fresh `items` array on every render, and Base UI republished it from a layout effect, re-rendering the trigger's value in a second commit. Any interaction on a panel holding a Select therefore committed twice — spending a stat point cost roughly twice the component renders it should. The option list now keeps its identity while the options are unchanged.
