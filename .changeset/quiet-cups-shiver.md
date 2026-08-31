---
"@bombfarm/desktop": patch
"@bombfarm/game-art": patch
"@bombfarm/domain": patch
"@bombfarm/ui": patch
---

Typecheck the desktop renderer at the repo's own strictness bar.

The renderer's tsconfig came from a stock Next.js template: it set `strict` and stopped there,
never extending `tsconfig.base.json`. Two flags the base turns on — `exactOptionalPropertyTypes`
and `noUncheckedIndexedAccess` — were therefore off for every renderer file, and the desktop's
typecheck was passing at a bar looser than the rest of the repo. ESLint parsed the same files
through a base-tier program but only ever reports its own rules, so around fifty real type errors
sat in the renderer with every check green.

The renderer project now extends the base, and the errors that surfaced are fixed rather than
suppressed. Most were optional React props declared `?: T` while the caller passes a computed
`T | undefined` — a distinction `exactOptionalPropertyTypes` draws and React does not, so those
props now say `?: T | undefined`. Three were genuine unchecked reads: a hero's rarity index past
the end of the rarity list produced an undefined tier rather than the documented "unknown", the
toast queue re-read a coalesced entry by an index it had already proved, and `DEFAULT_INVENTORY_SORT`
could not tell a consumer that it always has a leading term.

A guard asserts the resolved strictness of both desktop projects, so this cannot silently lapse
again.

Lint's desktop project is split in two along the same seam. It had been one program spanning the
main process and the renderer — two runtimes that never share a global scope, and whose global
declarations contradict each other on purpose. Each half now has its own project, so the program
lint builds is one a compiler could actually accept.
