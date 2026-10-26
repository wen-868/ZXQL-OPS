; ============================================================
; 智享全链运营系统 · NSIS 完整安装版
; 安装到 Program Files → 开始菜单/桌面快捷方式 → 控制面板可卸载
; 卸载时自动停止服务栈（杀客户端 + start.ps1 -Rollback）并删除全部数据
; ============================================================
Unicode true

!define APP_NAME "智享全链运营系统"
!define APP_VERSION "0.1.0"
!define APP_PUBLISHER "智享全链科技"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\ZXQLOps"

Name "${APP_NAME}"
OutFile "智享全链运营系统_安装版_v${APP_VERSION}.exe"
; per-user 安装：无需管理员权限，运行期对安装目录完全可写（服务栈需写入 logs/ 与数据库）
InstallDir "$LOCALAPPDATA\ZXQL-Ops"
InstallDirRegKey HKCU "${UNINST_KEY}" "InstallLocation"
RequestExecutionLevel user
Icon "desktop\logo.ico"
UninstallIcon "desktop\logo.ico"

!include "MUI2.nsh"
!include "FileFunc.nsh"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\ZXQLOpsDesktop.exe"
!define MUI_FINISHPAGE_RUN_TEXT "立即启动${APP_NAME}"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"

Section "安装${APP_NAME}" SecMain
  SetOutPath "$INSTDIR"
  File /r "installer-bundle\*.*"

  ; 卸载器
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; 开始菜单
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\ZXQLOpsDesktop.exe" "" "$INSTDIR\ZXQLOpsDesktop.exe"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\卸载${APP_NAME}.lnk" "$INSTDIR\uninstall.exe"

  ; 桌面快捷方式
  CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\ZXQLOpsDesktop.exe" "" "$INSTDIR\ZXQLOpsDesktop.exe"

  ; 控制面板卸载信息（HKCU，per-user 安装）
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\ZXQLOpsDesktop.exe"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  WriteRegDWORD HKLM "${UNINST_KEY}" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
  ; 停止运行中的桌面客户端与服务栈（同步等待完成）
  ExecWait 'taskkill /F /IM ZXQLOpsDesktop.exe'
  ExecWait 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\start.ps1" -Rollback'
  Sleep 2000

  ; 删除快捷方式
  Delete "$DESKTOP\${APP_NAME}.lnk"
  RMDir /r "$SMPROGRAMS\${APP_NAME}"

  ; 删除卸载信息
  DeleteRegKey HKCU "${UNINST_KEY}"

  ; 删除安装目录（含全部数据）
  RMDir /r "$INSTDIR"
SectionEnd
