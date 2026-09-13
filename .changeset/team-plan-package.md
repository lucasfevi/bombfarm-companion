---
"@bombfarm/team-plan": minor
"@bombfarm/web": patch
---

A new package holds the optimizer: its screen, the runner and its worker, the input model and
the rules that decide when a plan is stale and which control changes clear it. The web planner now
draws `/optimizer` from that package through a connector that maps its own store onto the
package's flat inputs record, and nothing on the page changes for a player — same layout, same
strings, same behaviour, proven by the optimizer's browser suite passing without an edit.

Strings that name a screen only one host has — the empty states and their call to action, the
remedy shown when gold scoring has no furthest phase, the two disclosures that name the Planner
and the Account tab, the farm advisor's pointer, and the blocked notice's re-export sentence — are
a contract type each host satisfies from its own dictionary. A host-neutral test forbids those
words in the shared dictionary and demonstrates its own red state.

The scope hero card, the per-hero delta row and the waterfall step cell carry an explicit
`memo()`: the React Compiler does not run over a package a host transpiles, so a component that
reaches a host that way keeps only the memoisation its own source spells.
