---
"@bombfarm/contracts": minor
"@bombfarm/desktop": minor
---

**The desktop now speaks English and Brazilian Portuguese throughout.** It defaults from the
system language (every Portuguese OS locale variant — `pt-PT`, `pt-AO`, bare `pt` — resolves to
the one Portuguese translation that exists), is switchable at any time from a new Settings tab,
and the choice is remembered across restarts. Every screen — navigation, status chrome, planning
views, fidelity messages, empty states, errors — renders from one typed, compile-time-checked
string source per language; a key present in only one language fails the build rather than
shipping a half-translated screen.

Game terms (hero rarity today; ability/house/slot/set names as the shell grows to render them)
follow the chosen language through `@bombfarm/domain`'s existing `game-labels.ts` helpers — the
underlying stored key is unchanged, localisation is display-layer only. Numbers and relative-age
text follow the locale too: DPS and counts group thousands the PT-BR way (`1.234` vs `1,234`), and
next-point gains sign and format per locale (`+1,5%` vs `+1.5%`).

A language switch is a display change, never an account change — it triggers no refresh and no
advice recompute, proved both structurally (the locale cannot enter any change key) and by a
compute-count assertion. If the chosen language cannot be saved (a read-only save location), the
language still applies for the session and the failure is surfaced, rather than silently
reverting on the next launch.

`packages/contracts` gains `AppLocale`, `DOMAIN_LANG_BY_LOCALE`, `BCP47_BY_LOCALE`,
`resolveStartupLocale` and two verb-shaped settings channels — the one place the desktop's locale
token maps to the domain's language and to `Intl`'s BCP-47 tags; the existing `contextBridge` is
unchanged (zero-argument channels, following the shipped consent quartet's shape).

**No behaviour change for the web planner.** `apps/web` is untouched — zero files changed, source
and tests alike — and its own `Lang`/`bf_lang`/`pt` default and namespace files are unaffected.
`packages/ui` and `packages/domain` are untouched too: four English `aria-label`s inside
`packages/ui` (`AppShell`'s nav landmark, `Num`'s increment/decrement) and the `ConsentModal`'s
legal disclosure stay English by design — `packages/ui` may not change, and the consent text's
`textVersion` means a translated rendering could constitute wording the player never agreed to.
Both are pinned, named exceptions, not oversights.
