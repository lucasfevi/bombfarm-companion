---
"@bombfarm/desktop": patch
---

Harden the installed app: it can no longer be run as a plain Node runtime or attached to with debugging flags, it only loads its code from its own packaged archive, and it checks that archive's integrity at startup.
