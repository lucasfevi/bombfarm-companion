---
"@bombfarm/desktop": patch
---

Harden the installed app: it can no longer be run as a plain Node runtime, ignores `NODE_OPTIONS` and the Node inspector flags, exits at startup when launched with a remote-debugging switch, only loads its code from its own packaged archive, and checks that archive's integrity at startup.
