<?php

// Only a newly-created, randomly named verification database is migrated/written.
// Never point the application connection or PHPUnit RefreshDatabase at live data.
use App\Models\Attribute;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductHighlight;
use App\Models\WarehouseStock;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

if (! $app->environment(['local', 'testing'])) {
    fwrite(STDERR, "Verification is restricted to local/testing environments.\n");
    exit(1);
}

function integrityAssert(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

function rejectedWrite(Closure $operation, array $codes): void
{
    try {
        $operation();
    } catch (QueryException $error) {
        integrityAssert(in_array((int) ($error->errorInfo[1] ?? 0), $codes, true), 'Write failed for a reason other than the expected integrity constraint.');

        return;
    }

    throw new RuntimeException('Invalid database write was accepted.');
}

function rejectedMigration(object $migration, string $message): void
{
    try {
        $migration->up();
    } catch (RuntimeException $error) {
        integrityAssert(str_contains($error->getMessage(), $message), 'Migration failed for an unexpected reason.');

        return;
    }

    throw new RuntimeException('Migration accepted inconsistent existing data.');
}

$control = DB::connection('mysql');
$database = 'durafit_integrity_check_'.bin2hex(random_bytes(6));
$created = false;
$exitCode = 0;
$stage = 'connect';
try {
    integrityAssert((bool) preg_match('/^durafit_integrity_check_[a-f0-9]{12}$/D', $database), 'Invalid verification database name.');
    integrityAssert($database !== $control->getDatabaseName(), 'Cannot use the application database.');
    fwrite(STDOUT, 'Database server: '.$control->getServerVersion()."\n");
    $stage = 'create isolated verification database';
    $control->statement("CREATE DATABASE `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $created = true;
    $connection = config('database.connections.mysql');
    $connection['database'] = $database;
    $connection['url'] = null;
    config(['database.connections.integrity_check' => $connection, 'database.default' => 'integrity_check', 'cache.default' => 'array']);
    DB::purge('integrity_check');
    $stage = 'migrate isolated database';
    integrityAssert(Artisan::call('migrate', ['--database' => 'integrity_check', '--force' => true]) === 0, 'Verification migrations failed.');
    $stage = 'verify constraints and migration round trip';

    $stock = WarehouseStock::factory()->create(['quantity' => 4, 'reserved_quantity' => 2]);
    foreach ([[2, 3], [-1, 0], [1, -1]] as [$quantity, $reserved]) {
        rejectedWrite(fn () => DB::table('warehouse_stocks')->where('id', $stock->id)->update([
            'quantity' => $quantity, 'reserved_quantity' => $reserved,
        ]), [3819, 4025, 1264]);
    }
    $newStock = WarehouseStock::factory()->make()->getAttributes();
    rejectedWrite(fn () => DB::table('warehouse_stocks')->insert(array_merge($newStock, [
        'id' => (string) Str::uuid(), 'quantity' => 1, 'reserved_quantity' => 2,
    ])), [3819, 4025]);
    integrityAssert($stock->fresh()->quantity === 4 && $stock->fresh()->reserved_quantity === 2, 'Rejected write changed stock.');
    $stock->update(['quantity' => 0, 'reserved_quantity' => 0]);

    $attribute = Attribute::query()->create(['name' => 'Motor', 'slug' => 'motor', 'data_type' => 'text']);
    $product = Product::factory()->create();
    $other = Product::factory()->create();
    $specification = ProductAttribute::query()->create(['product_id' => $product->id, 'attribute_id' => $attribute->id, 'value' => '3 HP Peak']);
    rejectedWrite(fn () => ProductHighlight::query()->create(['product_id' => $other->id, 'product_attribute_id' => $specification->id]), [1452]);
    $highlight = ProductHighlight::query()->create(['product_id' => $product->id, 'product_attribute_id' => $specification->id]);
    rejectedWrite(fn () => $highlight->update(['product_id' => $other->id]), [1452]);
    rejectedWrite(fn () => $specification->update(['product_id' => $other->id]), [1451]);
    $specification->refresh();
    rejectedWrite(fn () => DB::transaction(function () use ($specification, $other): void {
        $specification->update(['value' => 'Changed']);
        ProductHighlight::query()->create(['product_id' => $other->id, 'product_attribute_id' => $specification->id]);
    }), [1452]);
    integrityAssert($specification->fresh()->value === '3 HP Peak', 'Transaction did not roll back.');

    $stockMigration = require database_path('migrations/2026_10_10_100000_enforce_warehouse_stock_balance.php');
    $stockMigration->down();
    $stock->update(['reserved_quantity' => 1]);
    rejectedMigration($stockMigration, 'Invalid warehouse stock balances');
    integrityAssert($stock->fresh()->reserved_quantity === 1, 'Preflight silently changed stock.');
    $stock->update(['reserved_quantity' => 0]);
    $stockMigration->up();
    rejectedWrite(fn () => $stock->update(['reserved_quantity' => 1]), [3819, 4025]);

    $ownershipMigration = require database_path('migrations/2026_10_10_101000_enforce_product_highlight_ownership.php');
    $ownershipMigration->down();
    DB::table('product_highlights')->where('id', $highlight->id)->update(['product_id' => $other->id]);
    rejectedMigration($ownershipMigration, 'Invalid product highlight ownership');
    integrityAssert($highlight->fresh()->product_id === $other->id, 'Preflight silently changed highlight.');
    DB::table('product_highlights')->where('id', $highlight->id)->update(['product_id' => $product->id]);
    $ownershipMigration->up();
    $ownershipMigration->up(); // Simulate resuming completed DDL before migration logging.
    rejectedWrite(fn () => DB::table('product_highlights')->where('id', $highlight->id)->update(['product_id' => $other->id]), [1452]);
    $specification->delete();
    integrityAssert(! ProductHighlight::query()->whereKey($highlight->id)->exists(), 'Specification cascade was not preserved.');
    integrityAssert(Product::query()->whereKey($product->id)->exists(), 'Product was unexpectedly removed.');
    fwrite(STDOUT, "PASS: stock insert/update constraints, ownership insert/update constraints, transaction rollback, cascade, migration preflight and down/up preservation.\n");
} catch (Throwable $error) {
    // Do not print connection credentials, SQL bindings or customer data.
    $driverCode = $error instanceof QueryException ? ($error->errorInfo[1] ?? 'unknown') : 'n/a';
    fwrite(STDERR, 'FAIL during '.$stage.': '.get_class($error).' (code '.$error->getCode().', driver '.$driverCode."). No application data was modified.\n");
    $exitCode = 1;
} finally {
    if ($created) {
        DB::purge('integrity_check');
        $control->statement("DROP DATABASE `{$database}`");
        fwrite(STDOUT, "Removed isolated verification database {$database}; application database untouched.\n");
    }
}
exit($exitCode);
