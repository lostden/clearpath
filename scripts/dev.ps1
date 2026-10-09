param(
  [switch]$Check,
  [switch]$Tunnel,
  [switch]$Clear
)
$ErrorActionPreference = 'Stop'
if ($Check -and ($Tunnel -or $Clear)) {
  throw 'Use -Check separately from the startup options -Tunnel and -Clear.'
}
$taskRuntime = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
$taskTools = Join-Path $PSScriptRoot '..\..\.tools\node_modules\.bin'
if (Test-Path -LiteralPath "$taskRuntime\node\bin\node.exe") {
  $env:PATH = "$taskTools;$taskRuntime\node\bin;$taskRuntime\native\git\cmd;$env:PATH"
}
Set-Location -LiteralPath (Join-Path $PSScriptRoot '..')
if ($Check) {
  npm run typecheck
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  npm run lint
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  npm test
} else {
  $taskExpoCli = Join-Path $PSScriptRoot '..\node_modules\expo\bin\cli'
  if (-not (Test-Path -LiteralPath $taskExpoCli)) {
    throw 'Project dependencies are missing. Install them with npm ci before starting ClearPath.'
  }
  $taskExpoArgs = @('start', '--go')
  if ($Tunnel) { $taskExpoArgs += '--tunnel' }
  if ($Clear) { $taskExpoArgs += '--clear' }
  & node $taskExpoCli @taskExpoArgs
}
exit $LASTEXITCODE
