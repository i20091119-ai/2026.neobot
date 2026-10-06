@echo off
rem Neobot SW - open the app in Edge (or Chrome) app window
rem The real work is in launch.ps1: it builds a proper file:/// URL (Korean / spaces in the folder path are encoded)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch.ps1"
if errorlevel 1 pause
