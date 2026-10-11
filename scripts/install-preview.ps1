#requires -Version 5.1
<#
.SYNOPSIS
Verify and install the signed ClearPath preview APK over USB.
.EXAMPLE
powershell -ExecutionPolicy Bypass -File .\scripts\install-preview.ps1
.EXAMPLE
powershell -ExecutionPolicy Bypass -File .\scripts\install-preview.ps1 -DeviceSerial PHONE_SERIAL -NoLaunch
.NOTES
Requires the APK and its verified build metadata. Updates use adb install -r;
the script never uninstalls an app or clears its data.
#>
[CmdletBinding()]
param(
  [string]$ApkPath,
  [string]$MetadataPath,
  [string]$AdbPath,
  [string]$DeviceSerial,
  [switch]$NoLaunch
)
$ErrorActionPreference = 'Stop'
$taskProject = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $ApkPath) { $ApkPath = Join-Path $taskProject 'artifacts\ClearPath-latest.apk' }
if (-not $MetadataPath) { $MetadataPath = Join-Path $taskProject 'artifacts\ClearPath-preview.json' }

if (-not (Test-Path -LiteralPath $ApkPath -PathType Leaf)) {
  throw 'Preview APK is missing. Download the verified ClearPath-latest.apk into artifacts, or supply -ApkPath with its matching -MetadataPath.'
}
if (-not (Test-Path -LiteralPath $MetadataPath -PathType Leaf)) {
  throw 'Preview metadata is missing. Obtain the matching ClearPath-preview.json before installing.'
}
$taskApk = (Resolve-Path -LiteralPath $ApkPath).Path
$taskMetadataFile = (Resolve-Path -LiteralPath $MetadataPath).Path
try { $taskMetadata = Get-Content -LiteralPath $taskMetadataFile -Raw | ConvertFrom-Json }
catch { throw 'Preview metadata is not valid JSON. Obtain the matching verified build metadata.' }
if ($taskMetadata -isnot [System.Management.Automation.PSCustomObject]) { throw 'Preview metadata must be a single build object. Installation stopped.' }
foreach ($taskField in @('apkFileName', 'sha256', 'buildId', 'packageName', 'appVersion', 'signingCertificateSha1')) {
  if ($taskMetadata.$taskField -isnot [string] -or [string]::IsNullOrWhiteSpace($taskMetadata.$taskField)) {
    throw "Preview metadata is missing a valid $taskField. Obtain the matching verified build metadata."
  }
}
$taskPackage = 'org.clearpath.student'
if ($taskMetadata.packageName -cne $taskPackage) { throw 'Preview metadata does not identify the ClearPath Android package. Installation stopped.' }
if ($taskMetadata.apkFileName -ne [System.IO.Path]::GetFileName($taskApk) -or
    $taskMetadata.apkFileName -ne [System.IO.Path]::GetFileName($taskMetadata.apkFileName) -or
    [System.IO.Path]::GetExtension($taskApk) -ine '.apk') {
  throw 'The APK filename does not match its metadata. Use the original APK and matching metadata together.'
}
if ($taskMetadata.sha256 -notmatch '^[A-Fa-f0-9]{64}$' -or
    ($taskMetadata.signingCertificateSha1 -replace ':', '') -notmatch '^[A-Fa-f0-9]{40}$' -or
    ($taskMetadata.versionCode -isnot [int] -and $taskMetadata.versionCode -isnot [long]) -or
    $taskMetadata.versionCode -lt 1) {
  throw 'Preview metadata has an invalid checksum, signing identity, or Android version code. Installation stopped.'
}
$taskActualHash = (Get-FileHash -LiteralPath $taskApk -Algorithm SHA256).Hash
if ($taskActualHash -ine $taskMetadata.sha256) {
  throw 'APK checksum does not match the verified build metadata. Download the matching APK again; installation stopped.'
}

if (-not $AdbPath) {
  $taskBundledAdb = [System.IO.Path]::GetFullPath((Join-Path $taskProject '..\.tools\android-sdk\platform-tools\adb.exe'))
  if (Test-Path -LiteralPath $taskBundledAdb -PathType Leaf) { $AdbPath = $taskBundledAdb }
  else {
    $taskAdbCommand = Get-Command adb.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($taskAdbCommand) { $AdbPath = $taskAdbCommand.Source }
    else { throw 'Android Platform Tools are missing. Download them from https://developer.android.com/tools/releases/platform-tools and supply -AdbPath with the adb.exe path.' }
  }
}
if (-not (Test-Path -LiteralPath $AdbPath -PathType Leaf)) { throw 'The specified adb.exe does not exist. Check -AdbPath.' }
$taskAdb = (Resolve-Path -LiteralPath $AdbPath).Path
$taskDeviceLines = @(& $taskAdb devices -l)
if ($LASTEXITCODE -ne 0) { throw 'ADB could not list devices. Reconnect the USB cable and check the Android USB driver.' }
$taskDevices = @($taskDeviceLines | ForEach-Object {
  if ($_ -match '^(\S+)\s+(device|unauthorized|offline|recovery|sideload|bootloader)(?:\s|$)') {
    [pscustomobject]@{ Serial = $matches[1]; State = $matches[2] }
  }
})
# Network and emulator transports are excluded even when a serial is supplied.
$taskUsbDevices = @($taskDevices | Where-Object { $_.Serial -notmatch ':|^emulator-|\._adb[^.]*\._tcp\.?$' })
if ($DeviceSerial) {
  $taskUsbDevices = @($taskUsbDevices | Where-Object { $_.Serial -ceq $DeviceSerial })
  if ($taskUsbDevices.Count -eq 0) { throw 'The selected USB phone is not connected. Check -DeviceSerial, reconnect a USB data cable, and enable USB debugging.' }
}
$taskAuthorized = @($taskUsbDevices | Where-Object { $_.State -eq 'device' })
if ($taskAuthorized.Count -gt 1) { throw 'More than one authorized USB phone is connected. Supply -DeviceSerial or disconnect the others.' }
if ($taskAuthorized.Count -eq 0) {
  if ($taskUsbDevices.State -contains 'unauthorized') { throw 'Unlock the phone and approve Allow USB debugging, then run this command again.' }
  if ($taskUsbDevices.Count -gt 0) { throw 'The USB phone is not ready in ADB. Start Android normally, unlock it, and reconnect the cable.' }
  throw 'No USB phone detected. Connect a data cable, enable USB debugging, and unlock the phone. Try File transfer USB mode or the manufacturer USB driver if needed.'
}
$taskDevice = $taskAuthorized[0]
$taskAdbArgs = @('-s', $taskDevice.Serial)
Write-Output "Verified ClearPath $($taskMetadata.appVersion) (Android version $($taskMetadata.versionCode)); installing over USB..."
$taskInstallOutput = @(& $taskAdb @taskAdbArgs install -r $taskApk)
if ($LASTEXITCODE -ne 0 -or -not ($taskInstallOutput | Where-Object { $_.Trim() -eq 'Success' })) {
  throw ('Android did not install the APK. Keep the existing app and its data; check the installer response before retrying. ' + ($taskInstallOutput -join ' '))
}
Write-Output 'ClearPath installed. The app can run after the USB cable is disconnected.'
if ($NoLaunch) { return }
$taskLaunchOutput = @(& $taskAdb @taskAdbArgs shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -p $taskPackage)
if ($LASTEXITCODE -ne 0 -or ($taskLaunchOutput -match '^\s*(Error:|Exception:|Status:\s*timeout)')) {
  throw ('ClearPath was installed, but Android could not open it. Open ClearPath from the phone app drawer. ' + ($taskLaunchOutput -join ' '))
}
Write-Output 'ClearPath launch requested. Check the phone screen.'
