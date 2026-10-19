# Dot-source this file from Admin-Backend before running `php artisan test`.
$durafitPhpDir = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe'
$durafitPhpExe = Join-Path $durafitPhpDir 'php.exe'
if (-not (Test-Path $durafitPhpExe)) {
    throw "JPEG-capable PHP 8.4 was not found at $durafitPhpExe"
}

$env:PATH = "$durafitPhpDir;$env:PATH"
$env:PHP_INI_SCAN_DIR = $PSScriptRoot
