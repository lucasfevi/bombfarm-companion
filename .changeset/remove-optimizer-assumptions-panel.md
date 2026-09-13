---
"@bombfarm/team-plan": minor
"@bombfarm/domain": minor
"@bombfarm/web": minor
"@bombfarm/desktop": patch
---

The Optimizer no longer shows an "Assumptions & limits" panel under its results, on the web
planner or the desktop app. What it said was technical — unmodelled abilities, loadout drift
against the inventory snapshot, excluded-item counts, aura and Planner-divergence notes, forge
and Luck caveats, restricted-plan notes — and did not change what a player should do with the
plan above it. The run summary, gain breakdown and per-hero table are unchanged.

Everything that existed only to feed that panel goes with it: the `disclosures` field on a
computed team plan, the package component and its copy, and the four host-supplied strings each
app provided for it.
