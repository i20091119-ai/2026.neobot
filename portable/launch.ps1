# Neobot SW launcher (folder version)
# - Builds file:/// URL with [Uri] so Korean letters and spaces in the path are encoded
# - Separate browser profile (%LOCALAPPDATA%\NeobotSW) so it opens as its own app window
# - Writes launch-log.txt next to this file for troubleshooting
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$log = Join-Path $here 'launch-log.txt'
function Log($m) { Add-Content -LiteralPath $log -Value ("{0}  {1}" -f (Get-Date -Format s), $m) -Encoding UTF8 }
try {
  $index = Join-Path $here 'app\index.html'
  if (-not (Test-Path -LiteralPath $index)) { throw "app\index.html not found: $index" }
  $url = ([System.Uri]$index).AbsoluteUri
  $prof = Join-Path $env:LOCALAPPDATA 'NeobotSW'
  $cands = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  )
  $browser = $cands | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
  if (-not $browser) { throw 'Edge or Chrome not found. Please install Microsoft Edge or Google Chrome.' }
  $argList = @(
    ('--app="{0}"' -f $url),
    ('--user-data-dir="{0}"' -f $prof),
    '--allow-file-access-from-files',
    '--no-first-run', '--no-default-browser-check', '--start-maximized'
  )
  Log "browser=$browser"
  Log "url=$url"
  Start-Process -FilePath $browser -ArgumentList $argList
  exit 0
} catch {
  Log ("ERROR " + $_.Exception.Message)
  Write-Host ''
  Write-Host ('ERROR: ' + $_.Exception.Message)
  Write-Host ('See: ' + $log)
  exit 1
}
