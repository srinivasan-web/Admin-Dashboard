@echo off
setlocal
rem Process-local development settings; global php.ini is never changed.
set "DURAFIT_PHP_DIR=%LOCALAPPDATA%\Microsoft\WinGet\Packages\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe"
if not exist "%DURAFIT_PHP_DIR%\php.exe" (
    echo PHP 8.4 was not found at "%DURAFIT_PHP_DIR%".
    exit /b 1
)
if not exist "%~dp0vendor\autoload.php" (
    echo Install backend Composer dependencies before starting the server.
    exit /b 1
)
if not "%~1"=="" if not "%~1"=="--check" (
    echo Usage: serve-local.cmd [--check]
    exit /b 1
)
set "DURAFIT_OPCACHE_ARGS="
"%DURAFIT_PHP_DIR%\php.exe" -r "exit(extension_loaded('Zend OPcache') ? 0 : 1);"
if errorlevel 1 set DURAFIT_OPCACHE_ARGS=-d "zend_extension=%DURAFIT_PHP_DIR%\ext\php_opcache.dll"
"%DURAFIT_PHP_DIR%\php.exe" %DURAFIT_OPCACHE_ARGS% -d opcache.enable_cli=1 -r "if (!extension_loaded('Zend OPcache') || !opcache_get_status(false) || !extension_loaded('pdo_mysql') || !extension_loaded('mbstring') || !function_exists('imagejpeg')) { fwrite(STDERR, 'OPcache, PDO MySQL, mbstring and JPEG-capable GD are required.' . PHP_EOL); exit(1); }"
if errorlevel 1 exit /b 1
if "%~1"=="--check" (
    echo Local PHP runtime checks passed.
    exit /b 0
)
echo Starting local API at http://127.0.0.1:8000 with OPcache.
echo Source timestamps are checked on every request. Restart after .env changes.
echo Press Ctrl+C to stop. This is a development server.
pushd "%~dp0public"
"%DURAFIT_PHP_DIR%\php.exe" %DURAFIT_OPCACHE_ARGS% -d opcache.enable_cli=1 -d opcache.validate_timestamps=1 -d opcache.revalidate_freq=0 -S 127.0.0.1:8000 ..\vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php
set "DURAFIT_SERVER_EXIT=%ERRORLEVEL%"
popd
exit /b %DURAFIT_SERVER_EXIT%
