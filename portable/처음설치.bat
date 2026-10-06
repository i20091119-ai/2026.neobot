@echo off
rem Neobot SW - first-time setup: (1) unzip dongle driver (2) install driver (admin) (3) desktop shortcut
rem Messages are ASCII on purpose (Windows console code page)
cd /d "%~dp0"
set "DRV=%~dp0driver"
echo.
echo ==== Neobot SW first-time setup ====
echo.
echo [1/3] Unzip dongle driver...
if not exist "%DRV%\[Install]dongle driver.exe" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%~dp0[NEOPIA]dongle driver.zip' -DestinationPath '%DRV%' -Force"
)
if not exist "%DRV%\[Install]dongle driver.exe" (
  echo   ERROR: driver files not found. Unzip "[NEOPIA]dongle driver.zip" by hand and run "[Install]dongle driver.exe".
  goto shortcut
)
echo   OK
echo.
echo [2/3] Install dongle driver - click YES on the admin window, then Next / Finish.
start "" /wait "%DRV%\[Install]dongle driver.exe"
echo   Done (if it says already installed, that is OK)
echo.
:shortcut
echo [3/3] Desktop shortcut...
call "%~dp0Make-Desktop-Shortcut.bat"
echo.
echo ==== All done. Plug in the dongle and run the desktop icon (or Run.bat). ====
pause
