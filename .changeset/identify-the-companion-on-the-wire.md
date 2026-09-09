---
"@bombfarm/desktop": patch
---

Send a version-stamped `User-Agent` on account and forge requests. `node:https` sends no
user-agent of its own, so these requests were previously anonymous on the wire, leaving the server
operator no way to tell this tool apart from anything else. One transport now serves both the read
cycle and the forge run, so they identify themselves identically.
