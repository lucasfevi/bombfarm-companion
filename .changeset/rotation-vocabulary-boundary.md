---
"@bombfarm/contracts": patch
"@bombfarm/game-api": patch
---

Add a normalized, English-named `/rotation` snapshot, replacing raw wire fields at the boundary

`/rotation`'s wire body mixes Portuguese and English keys (a house object keyed by a Portuguese
name, energy fields with Portuguese names, alongside plain English fields like `cycle_secs` and
`battle_allowed`). `@bombfarm/game-api` now exposes `normalizeRotation(body, roster)`, translating
that wire body plus a `/roster` heroes list into an English-named `RotationSnapshot` (new types in
`@bombfarm/contracts`): per-hero energy, activity, and field/house status, joined with the roster's
name and grade where a match exists. Every field is validated and dropped independently on failure
— a bad or missing field never takes a sibling, a hero, or the whole section down with it — and
each drop is reported with the wire field it came from and why.

This is additive: nothing existing reads from `normalizeRotation` yet, so no shipped behavior
changes. A generated reference table of the wire-to-domain vocabulary lives at
`docs/wire-vocabulary.md`, and a guard confines Portuguese wire vocabulary to the one lexicon
module that documents it, everywhere else in this new boundary.
