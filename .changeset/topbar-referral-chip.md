---
"@bombfarm/web": patch
---

Add the referral code to the topbar as a compact chip — the code and a copy icon, nothing else.
The reason it exists ("we both get a reward once you clear stage 151") moves into its tooltip, so
the control stays terse in the header while the footer keeps the full sentence.

Both referral controls now use the `Tooltip` primitive from `@bombfarm/ui` instead of a native
`title` attribute, and share one `useReferralCopy` hook rather than duplicating the
clipboard-with-manual-selection fallback.
