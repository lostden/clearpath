param([switch]$Check)
$ErrorActionPreference = 'Stop'
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
} else { npm start }
exit $LASTEXITCODE
