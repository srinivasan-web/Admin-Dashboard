@echo off
setlocal
set "PHP_ROOT=%LOCALAPPDATA%\Microsoft\WinGet\Packages\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe"
if not exist "%PHP_ROOT%\php.exe" (
    echo PHP 8.4 with JPEG-capable GD was not found at "%PHP_ROOT%".
    exit /b 1
)
set "PATH=%PHP_ROOT%;%PATH%"
set "PHP_INI_SCAN_DIR=%~dp0tests\runtime"
cd /d "%~dp0"
php -r "if (!extension_loaded('gd') || !function_exists('imagejpeg')) { fwrite(STDERR, 'GD JPEG support is unavailable.' . PHP_EOL); exit(1); }"
if errorlevel 1 exit /b 1
php artisan test %*
exit /b %ERRORLEVEL%
