---
"@bombfarm/web": patch
---

The web planner no longer fails to open when the roster your browser has saved is damaged — a
half-written entry, or one edited by hand into something that is no longer a list of heroes. It
used to be handed straight to the code that walks the roster, which stopped on it before any part
of the planner had drawn, leaving a blank page with no way back. The planner now starts with an
empty roster instead, so you can import your save again and carry on. A well-formed roster is read
exactly as before.
