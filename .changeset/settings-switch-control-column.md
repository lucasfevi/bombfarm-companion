---
"@bombfarm/ui": patch
"@bombfarm/desktop": patch
---

The two always-on-top switches in Settings → Window drew on top of their own labels instead of
sitting in the row's control column, hiding the start of each label and leaving the switch itself
standing on end. A settings row places the label on the left and the control on the right, and the
control is recognised by a marker it carries; the switch was the one control that carried none, so
the row treated it as more label text. Both toggles now sit at the right of their row, and every
control the design system offers is checked against that contract.
