---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Fixes a regression the House-ceiling fix introduced: `resolveHouseRestSeconds` returned the
account's imported `casa.cycle_secs` unconditionally whenever it was positive, ignoring the
`houseIndex`/`level` it was actually asked about. Once an account imported with a captured House
cycle, the House and House-level pickers stopped changing any computed number (advisor DPS, the
farm board, the team plan) — the frozen save figure kept winning no matter what house or level was
selected, even though the picker's own displayed rest time kept changing. Repro: import an account,
switch House (or House level), advisor DPS/farm board/team plan numbers stayed pinned to the
imported figure.

`resolveHouseRestSeconds` now takes the (house, level) pair the save's `cycle_secs` was captured
at — `casa.active_casa - 1` / `casa.levels[active_casa - 1]` — and trusts the save's figure only
when the requested house/level equal that pair exactly; otherwise it falls back to the `HOUSES`
table, same as an account with no captured cycle at all. Two optional anchor params are threaded
end to end: `FarmContextForHeroInput`, `AdvisorPipelineInput`, `team-plan`'s `FarmContext`/
`TeamPlanAccountInput`, and the domain `AccountShared` shim all gain
`houseCycleSecsHouseIdx`/`houseCycleSecsLevel` (or `cycleSecsHouseIdx`/`cycleSecsLevel`) alongside
their existing `houseCycleSecs`/`cycleSecs`. Left unsupplied (the 3-arg call shape), the resolver
keeps its prior behaviour — trusting `cycleSecs` unconditionally — because every caller outside the
web planner's account store has no independent picker able to diverge from the import in the first
place; only the web store's account slice populates a real anchor, snapshotted separately from the
live `houseIdx`/`houseLevel` picker so a picker move is what falls back to the table, not a stale
anchor silently going along for the ride.

Two rendering surfaces also read the raw `HOUSES` table directly instead of the resolver the model
now uses everywhere else, so they contradicted the numbers they were labelling: the Account panel's
House-level field (`account-house-fields.tsx`) and the import preview's House summary
(`import-account-summary.tsx`). Both now call `resolveHouseRestSeconds` the same way the model
does.

API: `resolveHouseRestSeconds` (`@bombfarm/domain/model`) gains two optional trailing params,
`cycleSecsHouseIndex`/`cycleSecsLevel`. `AccountImportData`/`AccountShared` (web and domain) are
unchanged in shape at the import layer — the anchor is derived from the import's own
`houseIdx`/`houseLevel` at the moment `houseCycleSecs` is set, not a new parsed field.
