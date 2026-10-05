@echo off
rem Neobot SW - open in Edge app window (fallback: Chrome)
set "APP=%~dp0app\index.html"
set "URL=file:///%APP:\=/%"
set "PROF=%LOCALAPPDATA%\NeobotSW"
set "OPT=--app="%URL%" --user-data-dir="%PROF%" --allow-file-access-from-files --no-first-run --no-default-browser-check --start-maximized"
set "B=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%B%" set "B=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%B%" set "B=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%B%" set "B=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%B%" set "B=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not exist "%B%" (
  echo Edge or Chrome not found. Please install Microsoft Edge or Google Chrome.
  pause
  exit /b 1
)
start "" "%B%" %OPT%
