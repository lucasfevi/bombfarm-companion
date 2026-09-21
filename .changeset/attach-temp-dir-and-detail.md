---
"@bombfarm/desktop": patch
"@bombfarm/contracts": patch
---

The app now connects to the game on a machine whose Windows temp folder is not writable — some installers point `TEMP`/`TMP` at a folder under Program Files, and every connection attempt used to fail there with "Permission denied" and no explanation. Before its first attempt the app checks that folder, and when it cannot write there it uses a folder of its own instead. When a connection attempt still fails, the Live screen now prints the error itself under "Last error", so it can be read off the screen instead of dug out of a log file.
