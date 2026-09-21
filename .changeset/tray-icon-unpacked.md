---
"@bombfarm/desktop": patch
---

The tray icon loads on every installed copy, including machines whose temp folder is not writable. Electron loads a `.ico` from inside the app archive by copying it to the system temp folder first; on a machine whose `TEMP`/`TMP` point at a folder the app cannot write to, that copy failed, the icon came back empty (`tray.create_failed` / `icon-empty` in the log), and the session ran with no tray — close-to-tray and the tray menu had nothing to attach to. The installer now ships the icon unpacked beside the archive and the app reads it from there, with no temp copy in the way.
