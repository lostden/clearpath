@echo off
setlocal
echo Connect your Android phone with a USB data cable.
echo Unlock it, enable USB debugging, and approve the USB debugging prompt.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-preview.ps1"
set "CLEARPATH_INSTALL_EXIT=%ERRORLEVEL%"
echo.
pause
exit /b %CLEARPATH_INSTALL_EXIT%
