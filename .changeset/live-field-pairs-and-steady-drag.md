---
"@bombfarm/ui": patch
"@bombfarm/desktop": patch
---

Dragging the window by its header no longer stutters or snaps back. The header carried a sticky
position, a stacking context and a backdrop blur inherited from the web planner, none of which
applies in a shell whose main region is the only thing that scrolls, and all of which put the
header on its own compositing layer — the layer the OS drags once the header is the title bar.

The header also now matches the caption strip beside it exactly, instead of sitting a shade
darker than it.

On the Live screen, the four field lists — on field, recovering, queued, benched — sit two to a
row instead of four full-width rows, so the whole field reads without scrolling past whichever
list is longest. They still stack on a narrow window.
