---
"@bombfarm/ui": patch
"@bombfarm/desktop": patch
---

The per-item price refresh button in the desktop Inventory now dims and shows a not-allowed cursor
while its quote is in flight, and keeps its tooltip — the button's only label — reachable the whole
time. It was marked with a prop the tooltip primitive reserves for a different purpose and never
puts on the button, so the dimming never applied and the label went silent while the request ran.
The button already refused a second press; that is unchanged.

A tooltip trigger no longer accepts `disabled`, because the underlying primitive reads that name as
"do not open the tooltip" and deliberately keeps it off the rendered element. A control that must be
genuinely inert passes `disabled` to its own element through `render`; one that must stay hoverable
and refuse the action uses `aria-disabled` plus a guard in its handler.
