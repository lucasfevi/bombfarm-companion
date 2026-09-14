---
"@bombfarm/web": patch
---

Show the "Referral code copied" confirmation on every page, not only the planner. The toast was
mounted inside the planner's keep-alive slot, which the Farm, Inventory, Optimizer, Account and
Download pages hide — the click copied the code but gave no visible sign it had. The import
result toast on those pages is fixed the same way.
