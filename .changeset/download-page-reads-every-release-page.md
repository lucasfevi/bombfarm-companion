---
"@bombfarm/web": patch
---

The download page resolves the stable build from GitHub's latest-release endpoint and walks every page of the release list for the install and update counts. It used to read only the first page of thirty: once a week of betas filled that page the button fell back to the releases page and the counts vanished, and even before that the counts were an undercount of whatever fit on page one.
