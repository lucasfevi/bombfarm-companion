# Comments

**Status:** hard truth — accepted 2026-08-23

Write almost no comments. The code and the tests **are** the documentation. A comment that
restates what the next line does is not documentation — it is a second copy of the logic that
nothing keeps in sync, and it goes stale the first time someone edits the line and not the prose.

## Rules

### CMT-1 — the default is zero

A well-named function, well-named variables, and a well-named test carry the meaning on their own.
Start from no comment and justify each one you add, not the other way round.

### CMT-2 — tests are the documentation of behaviour

When you want to explain *what something does* or *what happens in this edge case*, the place to
say it is a test with a sentence for a name — not a paragraph above the implementation. A test
proves the claim and fails when the claim stops being true; a comment does neither.

### CMT-3 — a comment-heavy file is a design defect

Treat the urge to comment as a **finding about the code**, the same way a long parameter list or a
300-line function is a finding. The fix is almost always to extract a well-named function, name an
intermediate value, or split the file — not to narrate what is there. Reach for prose only after
you have established that decomposition is not the fix.

### CMT-4 — two shapes earn a comment

Both explain **why**, never **what**:

1. **Inherent complexity that no decomposition removes** — a bitwise trick, a tight numerical
   routine, an algorithm whose correctness argument is not visible in the steps.
2. **Business logic not derivable from the code** — a game-balance constant and where its value
   came from, a workaround for an external quirk, a non-obvious invariant the surrounding code
   depends on, a deliberate deviation that reads like a bug.

Provenance is the strongest case in this repo: `packages/domain` carries constants whose *number*
is meaningless without the reason for it. Say what the value is and how it was established — a
wiki row, a fitted measurement, a deliberate clamp — and keep it to a line.

### CMT-5 — delete these on sight

| Shape | Example | Instead |
| --- | --- | --- |
| Narration | `// loop over the heroes` | Nothing. The loop says it. |
| Restated signature | `/** Returns the hero's rank. */` over `getHeroRank()` | Delete the block. |
| Section banners | `// ---- helpers ----` | Split the file, or trust the reader. |
| Commented-out code | `// const old = compute(x)` | Delete it. Git has it. |
| Changelog in source | `// 2026-08-12: fixed rounding` | Delete it. `git log` has it. |
| Bare `TODO` | `// TODO: handle empty roster` | Fix it, or file it — see [`../AGENTS.md`](../AGENTS.md). |

### CMT-6 — clean up the file you touch

Opening a comment-heavy file is the prompt to fix it. Delete the ones that narrate; keep the few
that satisfy CMT-4. This is in scope for whatever change brought you there and needs no separate
permission — it is the one cleanup the out-of-scope-findings rule does not ask you to escalate.

Do not do it as a drive-by whole-file rewrite of a file you are not otherwise changing: that
buries a real diff and destroys `git blame`, the same reason
[`line-endings.md`](line-endings.md) forbids in-place stream edits.

## Why there is no lint rule for this

Deliberate. No threshold distinguishes a comment recording where a game-balance constant came from
from a comment restating the line beneath it, and a rule that fires wrongly gets suppressed — after
which it enforces nothing while still appearing to. This one is carried by review and by the agent
guide, and the measure of it is whether files read well, not whether a counter is green.
