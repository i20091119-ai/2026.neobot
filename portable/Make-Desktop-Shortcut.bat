@echo off
rem Create desktop shortcut
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=[Environment]::GetFolderPath('Desktop'); $s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $d ((-join [char[]](0xB124,0xC624,0xBD07))+' SW'+(-join [char[]](0xCCB4,0xD5D8))+'.lnk'))); $s.TargetPath='%~dp0Run.bat'; $s.WorkingDirectory='%~dp0'; $s.IconLocation='%~dp0app\neobot.ico'; $s.WindowStyle=7; $s.Save()"
echo Done.
timeout /t 2 >nul
