!include "nsDialogs.nsh"
!include "LogicLib.nsh"

!ifndef BUILD_UNINSTALLER
  Var shortcutOptionsDialog
  Var desktopShortcutCheckbox
  Var startMenuShortcutCheckbox
  Var createDesktopShortcut
  Var createStartMenuShortcut

  !ifmacrodef customPageAfterChangeDir
    !undef customPageAfterChangeDir
  !endif
  !macro customPageAfterChangeDir
    Page custom ShortcutOptionsPage ShortcutOptionsLeave
  !macroend

  Function ShortcutOptionsPage
    nsDialogs::Create 1018
    Pop $shortcutOptionsDialog
    ${If} $shortcutOptionsDialog == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 20u "Choose where to add Edorax shortcuts."
    Pop $0

    ${NSD_CreateCheckbox} 0 32u 100% 16u "Add Edorax to the Start menu"
    Pop $startMenuShortcutCheckbox
    ${NSD_Check} $startMenuShortcutCheckbox

    ${NSD_CreateCheckbox} 0 58u 100% 16u "Create a desktop shortcut"
    Pop $desktopShortcutCheckbox
    ${NSD_Check} $desktopShortcutCheckbox

    nsDialogs::Show
  FunctionEnd

  Function ShortcutOptionsLeave
    ${NSD_GetState} $startMenuShortcutCheckbox $createStartMenuShortcut
    ${NSD_GetState} $desktopShortcutCheckbox $createDesktopShortcut
  FunctionEnd
!endif

!macro customInstall
  ${If} $createStartMenuShortcut == ${BST_CHECKED}
    CreateDirectory "$SMPROGRAMS\Edorax"
    CreateShortCut "$SMPROGRAMS\Edorax\Edorax.lnk" "$INSTDIR\Edorax.exe"
  ${EndIf}
  ${If} $createDesktopShortcut == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\Edorax.lnk" "$INSTDIR\Edorax.exe"
  ${EndIf}
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\Edorax\Edorax.lnk"
  RMDir "$SMPROGRAMS\Edorax"
  Delete "$DESKTOP\Edorax.lnk"
!macroend
