; electron-builder includes this file by name from the build resources folder.
;
; The app writes its Start with Windows entry at runtime, so the uninstaller does not know about it
; and a real install was seen leaving it behind. ${APP_ID} is the flavour's appId, which is also the
; entry's name, so each flavour removes only its own.
;
; This macro also runs when an update or a reinstall replaces the old version. The entry belongs to
; the player's setting, so it stays in those cases.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APP_ID}"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "${APP_ID}"
  ${endIf}
!macroend
