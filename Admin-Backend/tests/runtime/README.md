# Windows PHP test runtime

The Herd Lite PHP executable has GD, but its GD build lacks JPEG support.
Use the installed WinGet PHP 8.4 distribution with its matching extension DLLs.
This profile enables GD, mbstring and SQLite for tests without modifying global php.ini.

From `Admin-Backend`, run in PowerShell:

```powershell
. .\tests\runtime\use-php84.ps1
php artisan test --filter=CatalogApiTest
php artisan test
```

Alternatively, use the existing one-command wrapper:

```powershell
.\test.cmd --filter=CatalogApiTest
.\test.cmd
```

The wrapper selects the installed JPEG-capable PHP for this test process and
checks `imagejpeg()` before running Laravel. The equivalent manual setup is:

```powershell
$phpDir = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe'
$previousPath = $env:PATH
$previousScan = $env:PHP_INI_SCAN_DIR
try {
    $env:PATH = "$phpDir;$previousPath"
    $env:PHP_INI_SCAN_DIR = (Resolve-Path 'tests/runtime').Path
    php --ri gd
    php artisan test --compact
} finally {
    $env:PATH = $previousPath
    $env:PHP_INI_SCAN_DIR = $previousScan
}
```

`phpunit.xml` uses an in-memory SQLite database. These tests do not migrate the application MySQL database.
The primary-image constraint still needs to be applied to MySQL through the normal migration workflow.
Its preflight rejects duplicate primary images without changing image records; resolve those explicitly before retrying.

For the measured local API startup improvement, run `serve-local.cmd` from the
backend directory. It enables OPcache for that server process and checks source
timestamps on every request. See [performance.md](performance.md) for the
read-only profiler, before/after measurements, query map, and remaining benchmark gaps.
