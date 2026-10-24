---
"@bombfarm/domain": patch
"@bombfarm/hero": patch
"@bombfarm/web": patch
"@bombfarm/desktop": patch
---

The optimizer no longer asks you to move points that make no real difference. After it finds the best build, it puts back any change from your current build that is worth almost nothing (such as a single point in Speed), as long as the plan as a whole stays within 0.5% of the best it found. That cap covers all the dropped changes together, not each one. The gain each plan shows is now the gain of the trimmed plan you are asked to apply. A plan whose whole gain is under 0.5% now keeps your current build. This applies to the Team Plan on desktop and web, the Farm respec, and the Optimize button on each hero's points.
