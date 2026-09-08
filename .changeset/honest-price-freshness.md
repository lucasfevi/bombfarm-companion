---
"@bombfarm/pricing": patch
"@bombfarm/web": patch
"@bombfarm/desktop": patch
---

Date the "how old are these prices" line by the prices it covers instead of by the file that carried them. **Both apps were understating price age by hours.** Measured 2026-09-07, the Account and Inventory summaries read "Prices updated 12 minutes ago" over rows that were 6.6 hours old — and each of those rows was already saying so correctly, so the summary contradicted the list beneath it.

The published snapshot's `generatedUtc` is the age of the publish, not of any price in it. A rate-limited collection advances part of the sweep and carries the rest forward untouched, so the file is rewritten every run while individual quotes stay where they were; roughly thirteen consecutive passes collected nothing and republished, and every one of them reported success.

The rule was already written down and did not hold: all three summary call sites passed `generatedUtc` into a parameter named `quotedUtc`, because that value is in reach wherever such a line is drawn and reads like the answer. So the fix is the signature, not the callers. `formatPriceFreshness` (web) and `priceFreshness` (desktop) now take the resolved prices they summarise and derive the age themselves, and a snapshot-level timestamp is no longer a value either will accept.

The line states the **oldest** price it covers — "Oldest price read 6 h ago", "Preço mais antigo lido há 6 h" — because that is the only age true of every row above which it sits. Where no price it covers is dated, it draws nothing rather than an empty claim. Per-item rows are unchanged: each still reports its own quote's timestamp.
