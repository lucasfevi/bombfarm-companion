---
"@bombfarm/web": minor
---

Surface the maintainer's in-game referral code in the footer, next to the existing wiki credit
and coffee link — visible on every page without sitting in the planner workflow.

The code renders from a single `REFERRAL_CODE` constant (`shared/referral.ts`) with a copy button.
The copy uses the clipboard API and confirms with the app's existing toast; when the clipboard is
unavailable — insecure origin, or a denied permission — it selects the code text and says so
instead, so the click always has a visible effect. The copy control carries an accessible name and
a 24px target, and the wording states the reward is mutual rather than framing it as a one-way
favour. Strings are localized in both en and pt.
