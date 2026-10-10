<#
.SYNOPSIS
Launch ClearPath in the existing Android Expo Go app through a USB cable.
.EXAMPLE
powershell -ExecutionPolicy Bypass -File .\scripts\android-usb.ps1
.EXAMPLE
powershell -ExecutionPolicy Bypass -File .\scripts\android-usb.ps1 -Logs
#>
param(
  [switch]$Logs,
  [ValidateRange(1024, 65535)][int]$Port = 8082,
  [string]$AdbPath,
  [string]$DeviceSerial
)
$ErrorActionPreference = 'Stop'
$taskProject = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskRuntime = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
$taskTools = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\.tools'))
if (Test-Path -LiteralPath "$taskRuntime\node\bin\node.exe") {
  $env:PATH = "$taskTools\node_modules\.bin;$taskRuntime\node\bin;$env:PATH"
}
Set-Location -LiteralPath $taskProject
if (-not $AdbPath) {
  $taskBundledAdb = Join-Path $taskTools 'android-sdk\platform-tools\adb.exe'
  if (Test-Path -LiteralPath $taskBundledAdb) { $AdbPath = $taskBundledAdb }
  elseif (Get-Command adb.exe -ErrorAction SilentlyContinue) { $AdbPath = (Get-Command adb.exe).Source }
  else { throw 'Android Platform Tools are missing. Download them from https://developer.android.com/tools/releases/platform-tools and pass -AdbPath with the full adb.exe path.' }
}
if (-not (Test-Path -LiteralPath $AdbPath -PathType Leaf)) { throw 'The specified adb.exe does not exist.' }
$AdbPath = (Resolve-Path -LiteralPath $AdbPath).Path
$taskDeviceLines = @(& $AdbPath devices)
if ($LASTEXITCODE -ne 0) { throw 'ADB could not list devices.' }
$taskDevices = @($taskDeviceLines | ForEach-Object {
  if ($_ -match '^(\S+)\s+(device|unauthorized|offline)\s*$') {
    [pscustomobject]@{ Serial = $matches[1]; State = $matches[2] }
  }
})
if ($DeviceSerial) { $taskDevices = @($taskDevices | Where-Object { $_.Serial -eq $DeviceSerial }) }
else { $taskDevices = @($taskDevices | Where-Object { $_.Serial -notmatch ':|^emulator-' }) }
if ($taskDevices.Count -eq 0) { throw 'No USB phone detected. Connect a data cable, enable USB debugging, and unlock the phone. Some phones also require File transfer USB mode or the manufacturer USB driver.' }
if ($taskDevices.Count -gt 1) { throw 'More than one phone is connected. Disconnect the others or use -DeviceSerial to select one.' }
$taskDevice = $taskDevices[0]
if ($taskDevice.State -eq 'unauthorized') { throw 'Approve Allow USB debugging on the unlocked phone, then run this command again.' }
if ($taskDevice.State -ne 'device') { throw 'The phone is offline in ADB. Reconnect the cable and unlock it.' }
$taskAdbArgs = @('-s', $taskDevice.Serial)
$taskPackage = @(& $AdbPath @taskAdbArgs shell pm list packages host.exp.exponent)
if ($LASTEXITCODE -ne 0 -or -not ($taskPackage -contains 'package:host.exp.exponent')) { throw 'Expo Go is not installed for the current phone user. Install it on the phone before launching.' }
New-Item -ItemType Directory -Path (Join-Path $taskProject '.expo') -Force | Out-Null
if ($Logs) {
  $taskExpoPid = (@(& $AdbPath @taskAdbArgs shell pidof -s host.exp.exponent) -join '').Trim()
  if ($LASTEXITCODE -ne 0 -or $taskExpoPid -notmatch '^[1-9][0-9]*$') { throw 'Expo Go is not running. Open ClearPath through the USB launcher first; no whole-phone logs will be collected.' }
  $taskDeviceLog = Join-Path $taskProject '.expo\android-usb-device.log'
  $taskLogLines = @(& $AdbPath @taskAdbArgs logcat "--pid=$taskExpoPid" -b main -b crash -v threadtime -d -t 300 '*:W' 'ExpoUpdatesAppLoader:V' 'Exponent:V' 'ReactNativeJS:V')
  if ($LASTEXITCODE -ne 0) { throw 'Unable to collect Expo Go process logs.' }
  $taskLogLines | Set-Content -LiteralPath $taskDeviceLog -Encoding UTF8
  Write-Output "Saved bounded Expo Go process logs locally: $taskDeviceLog"
  Write-Output 'Logs may include app data. Review and redact them before sharing; they are not uploaded or committed.'
  exit 0
}
$taskNode = (Get-Command node.exe -ErrorAction Stop).Source
$taskExpoCli = Join-Path $taskProject 'node_modules\expo\bin\cli'
if (-not (Test-Path -LiteralPath $taskExpoCli)) { throw 'Install project dependencies before starting ClearPath.' }
$taskProbe = New-Object System.Net.Sockets.TcpClient
try {
  $taskConnect = $taskProbe.ConnectAsync('127.0.0.1', $Port)
  try { $null = $taskConnect.Wait(500) } catch { }
  if ($taskProbe.Connected) { throw "Port $Port is already in use. Stop the earlier USB launcher with Ctrl+C or choose another -Port." }
} finally { $taskProbe.Dispose() }
$taskMetroOut = Join-Path $taskProject '.expo\usb-metro-output.log'
$taskMetroError = Join-Path $taskProject '.expo\usb-metro-errors.log'
$taskMetro = $null
$taskReverseCreated = $false
try {
  & $AdbPath @taskAdbArgs reverse --no-rebind "tcp:$Port" "tcp:$Port"
  if ($LASTEXITCODE -ne 0) { throw "ADB could not create a USB connection on port $Port. Choose another -Port if that phone port is already mapped." }
  $taskReverseCreated = $true
  # Expo binds localhost but advertises 127.0.0.1. Prefer IPv4 for both USB and readiness.
  $taskArguments = @('--dns-result-order=ipv4first', ('"{0}"' -f $taskExpoCli), 'start', '--go', '--localhost', '--port', "$Port")
  $taskMetro = Start-Process -FilePath $taskNode -ArgumentList $taskArguments -WorkingDirectory $taskProject -WindowStyle Hidden -RedirectStandardOutput $taskMetroOut -RedirectStandardError $taskMetroError -PassThru
  Write-Output 'Starting the local USB development server...'
  Add-Type -AssemblyName System.Net.Http
  $taskHttp = New-Object System.Net.Http.HttpClient
  $taskHttp.Timeout = [TimeSpan]::FromSeconds(2)
  $taskReady = $false
  try {
    for ($taskAttempt = 0; $taskAttempt -lt 60; $taskAttempt++) {
      $taskMetro.Refresh()
      if ($taskMetro.HasExited) { throw "Expo exited. See $taskMetroError and $taskMetroOut." }
      try {
        $taskStatus = $taskHttp.GetStringAsync("http://127.0.0.1:$Port/status").GetAwaiter().GetResult()
        if ($taskStatus.Trim() -eq 'packager-status:running') { $taskReady = $true; break }
      } catch { }
      Start-Sleep -Milliseconds 500
    }
  } finally { $taskHttp.Dispose() }
  if (-not $taskReady) { throw "Expo did not become ready. See $taskMetroError and $taskMetroOut." }
  & $AdbPath @taskAdbArgs shell am force-stop host.exp.exponent
  if ($LASTEXITCODE -ne 0) { throw 'Unable to restart the Expo Go process.' }
  $taskLaunchOutput = @(& $AdbPath @taskAdbArgs shell am start -W -a android.intent.action.VIEW -d "exp://127.0.0.1:$Port" -p host.exp.exponent)
  if ($LASTEXITCODE -ne 0 -or ($taskLaunchOutput -match '^Error:')) { throw 'Unable to open ClearPath in Expo Go.' }
  if ($taskLaunchOutput -match 'Status:\s*timeout') {
    Write-Warning 'Android timed out waiting for Expo Go. Keep this server running and collect -Logs in a second terminal.'
  } else {
    Write-Output 'The ClearPath launch request was sent through USB. Check the phone screen to confirm it opened.'
  }
  Write-Output 'Keep this window and the cable connected; press Ctrl+C to stop.'
  Write-Output "If the phone still fails, run this script with -Logs in a second PowerShell window. Metro logs: $taskMetroOut"
  $taskPrintedLines = 0
  while (-not $taskMetro.HasExited) {
    $taskOutput = @(Get-Content -LiteralPath $taskMetroOut -ErrorAction SilentlyContinue)
    if ($taskOutput.Count -gt $taskPrintedLines) {
      $taskOutput | Select-Object -Skip $taskPrintedLines | Write-Output
      $taskPrintedLines = $taskOutput.Count
    }
    Start-Sleep -Milliseconds 500
    $taskMetro.Refresh()
  }
  throw "Expo stopped. See $taskMetroError for errors."
} finally {
  try {
    if ($taskMetro) {
      $taskMetro.Refresh()
      if (-not $taskMetro.HasExited) { Stop-Process -Id $taskMetro.Id -ErrorAction SilentlyContinue }
    }
  } finally {
    if ($taskReverseCreated) { & $AdbPath @taskAdbArgs reverse --remove "tcp:$Port" | Out-Null }
  }
}
