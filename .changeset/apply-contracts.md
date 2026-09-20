---
"@bombfarm/contracts": minor
---

Adds the wire vocabulary for applying a Team Plan's equip or points step: the `apply:start` /
`apply:stop` / `apply:inject` channels, the `apply:event` event, and the equip/points unit,
verdict, and run-event types the renderer, the domain and main all share. No shipped surface
consumes these yet — this lands the shared contract ahead of the packages that build on it.
