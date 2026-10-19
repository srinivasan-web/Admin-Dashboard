<?php

// Isolated real-MySQL verification; never runs migrations against the application database.
use App\Actions\CreateOrder;
use App\Actions\AllocateOrderWarehouse;
use App\Actions\ExpireStockReservations;
use App\Actions\ReserveOrderStock;
use App\Actions\SetWarehouseStock;
use App\Actions\TransitionOrderPayment;
use App\Actions\TransitionOrderShipment;
use App\Actions\TransitionOrderStatus;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\StockReservation;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use App\Http\Resources\OrderResource;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\InputStream;
use Symfony\Component\Process\Process;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

function verificationConnection(string $database): void
{
    if (! preg_match('/^durafit_inventory_check_[a-f0-9]{12}$/D', $database)) {
        throw new RuntimeException('Invalid verification database name.');
    }
    $connection = config('database.connections.mysql');
    $connection['database'] = $database;
    $connection['url'] = null;
    config(['database.connections.inventory_check' => $connection, 'database.default' => 'inventory_check']);
    DB::purge('inventory_check');
}

function verify(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

if (($argv[1] ?? '') === '--worker') {
    verificationConnection($argv[2]);
    fwrite(STDOUT, "READY\n");
    fgets(STDIN); // Parent releases both workers after both have booted.
    try {
        DB::beginTransaction();
        app(ReserveOrderStock::class)->execute(Order::query()->findOrFail($argv[3]));
        usleep(500000); // Keep the winning row lock while the competing request runs.
        DB::commit();
        fwrite(STDOUT, "RESERVED\n");
    } catch (InvalidArgumentException $exception) {
        DB::rollBack();
        if (! str_contains($exception->getMessage(), 'Insufficient available stock')) {
            throw $exception;
        }
        fwrite(STDOUT, "INSUFFICIENT\n");
    }
    exit(0);
}

$control = DB::connection('mysql');
$transactional = in_array('--transactional', $argv, true);
$database = 'durafit_inventory_check_'.bin2hex(random_bytes(6));
verify($database !== $control->getDatabaseName(), 'Verification must not use application database.');
$processes = [];
$created = false;
$exitCode = 0;
try {
    if ($transactional) {
        verify($app->environment(['local', 'testing']), 'Transactional verification is restricted to local/testing environments.');
        config(['database.default' => 'mysql']);
        verify(count(DB::select('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = ? AND ENGINE <> ?', ['BASE TABLE', 'InnoDB'])) === 0, 'All tables must support rollback.');
        DB::beginTransaction();
    } else {
    $control->statement("CREATE DATABASE `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $created = true;
    verificationConnection($database);
    verify(Artisan::call('migrate', ['--database' => 'inventory_check', '--force' => true]) === 0, 'Verification migrations failed.');
    }
    $columns = DB::select('SHOW COLUMNS FROM stock_reservations');
    verify(collect($columns)->contains('Field', 'expires_at'), 'MySQL expiry column is missing.');
    $indexes = DB::select('SHOW INDEX FROM stock_reservations');
    verify(collect($indexes)->contains('Key_name', 'stock_reservations_expiry_index'), 'MySQL expiry index is missing.');
    $address = ['name' => 'Verification', 'address' => 'Verification'];
    if (! $transactional) {
    $warehouse = Warehouse::factory()->create();
    $product = Product::factory()->create();
    $stock = WarehouseStock::factory()->create(['warehouse_id' => $warehouse->id, 'product_id' => $product->id, 'quantity' => 1, 'reserved_quantity' => 0]);
    $address = ['name' => 'Verification', 'address' => 'Verification'];
    $inputs = [];
    foreach ([1, 2] as $index) {
        $order = app(CreateOrder::class)->execute(Customer::factory()->create(), 'CHECK-'.$index, [['product' => $product, 'quantity' => 1, 'unit_price' => '100.00']], $address, $address, $warehouse);
        $input = new InputStream;
        $process = new Process([PHP_BINARY, __FILE__, '--worker', $database, $order->id], base_path(), timeout: 30);
        $process->setInput($input);
        $process->start();
        $processes[] = $process;
        $inputs[] = $input;
    }
    $deadline = microtime(true) + 20;
    while (! array_reduce($processes, fn ($ready, $process) => $ready && str_contains($process->getOutput(), 'READY'), true)) {
        verify(microtime(true) < $deadline, 'Workers did not become ready.');
        usleep(10000);
    }
    foreach ($inputs as $input) {
        $input->write("GO\n");
        $input->close();
    }
    foreach ($processes as $process) {
        $process->wait();
        verify($process->isSuccessful(), $process->getErrorOutput());
    }
    $output = implode('', array_map(fn ($process) => $process->getOutput(), $processes));
    verify(substr_count($output, 'RESERVED') === 1 && substr_count($output, 'INSUFFICIENT') === 1, 'Exactly one competing reservation must succeed.');
    verify($stock->fresh()->quantity === 1 && $stock->fresh()->reserved_quantity === 1 && $stock->fresh()->available_quantity === 0, 'Concurrent balances are inconsistent.');
    verify(StockReservation::query()->count() === 1 && StockMovement::query()->count() === 1, 'Concurrent reservation audit must be unique.');
    $winner = StockReservation::query()->sole()->order;
    app(ReserveOrderStock::class)->execute($winner);
    $payment = $winner->payments()->create(['provider' => 'verification', 'provider_transaction_reference' => 'CHECK-PAYMENT', 'amount' => '100.00', 'currency' => 'INR', 'status' => 'authorized']);
    app(TransitionOrderPayment::class)->execute($winner, $payment, 'paid');
    app(TransitionOrderPayment::class)->execute($winner, $payment, 'paid');
    verify($stock->fresh()->quantity === 0 && $stock->fresh()->reserved_quantity === 0 && StockMovement::query()->count() === 2, 'Commit retries must not deduct twice.');
    app(TransitionOrderStatus::class)->execute($winner, 'cancelled');
    app(TransitionOrderStatus::class)->execute($winner, 'cancelled');
    verify($stock->fresh()->quantity === 1 && StockMovement::query()->count() === 3, 'Restore retries must not restock twice.');
    fwrite(STDOUT, "PASS: MySQL migrations, concurrent reservation, commit retry, restore retry, balances and audit uniqueness.\n");
    }

    // Additional lifecycle uses the application's stock/order actions for every inventory change.
    $stock = app(SetWarehouseStock::class)->execute(Warehouse::factory()->create(['name' => 'Verification warehouse']), Product::factory()->create(), 20);
    $flowOrder = app(CreateOrder::class)->execute(Customer::factory()->create(), 'CHECK-FULL-FLOW', [
        ['product' => $stock->product, 'quantity' => 2, 'unit_price' => '100.00'],
    ], $address, $address);
    $snapshots = [];
    $snapshot = function (Order $order) use (&$snapshots): void {
        $order = $order->fresh()->load(['customer', 'warehouse', 'items', 'billingAddress', 'shippingAddress', 'stockReservations', 'payments', 'shipments.warehouse', 'statusHistories']);
        $snapshots[] = (new OrderResource($order))->resolve(Request::create('/api/v1/admin/orders/'.$order->id));
    };
    app(AllocateOrderWarehouse::class)->execute($flowOrder, $stock->warehouse);
    verify($stock->fresh()->quantity === 20 && $stock->fresh()->reserved_quantity === 0, 'Allocation must not reserve or deduct.');
    app(ReserveOrderStock::class)->execute($flowOrder);
    verify($stock->fresh()->quantity === 20 && $stock->fresh()->reserved_quantity === 2 && $stock->fresh()->available_quantity === 18, 'Reservation balances mismatch.');
    $snapshot($flowOrder);
    $payment = $flowOrder->payments()->create(['provider' => 'verification', 'provider_transaction_reference' => 'CHECK-FULL-PAYMENT', 'amount' => '200.00', 'currency' => 'INR', 'status' => 'authorized']);
    app(TransitionOrderPayment::class)->execute($flowOrder, $payment, 'paid');
    verify($stock->fresh()->quantity === 18 && $stock->fresh()->reserved_quantity === 0, 'Commit balances mismatch.');
    $snapshot($flowOrder);
    foreach (['processing', 'picked', 'packed', 'invoiced', 'ready_to_ship', 'completed'] as $status) {
        app(TransitionOrderStatus::class)->execute($flowOrder, $status);
    }
    $shipment = $flowOrder->shipments()->create(['warehouse_id' => $stock->warehouse_id, 'carrier' => 'Verification', 'status' => 'pending']);
    foreach (['processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'] as $status) {
        app(TransitionOrderShipment::class)->execute($flowOrder, $shipment, $status);
        verify($stock->fresh()->quantity === 18 && $stock->fresh()->reserved_quantity === 0, 'Shipment/delivery deducted stock again.');
    }
    $snapshot($flowOrder);

    $expiryStock = app(SetWarehouseStock::class)->execute($stock->warehouse, Product::factory()->create(), 20);
    $expiryOrder = app(CreateOrder::class)->execute(Customer::factory()->create(), 'CHECK-EXPIRY', [
        ['product' => $expiryStock->product, 'quantity' => 2, 'unit_price' => '100.00'],
    ], $address, $address, $expiryStock->warehouse);
    app(ReserveOrderStock::class)->execute($expiryOrder);
    $deadline = $expiryOrder->stockReservations()->sole()->expires_at;
    verify($deadline !== null, 'Reservation deadline missing.');
    Carbon::setTestNow($deadline);
    if ($transactional) {
        verify(app(ExpireStockReservations::class)->execute($expiryOrder) === 1, 'Expiry failed.');
    } else {
        verify(Artisan::call('inventory:expire-reservations') === 0, 'Scheduled expiry command failed.');
    }
    verify($expiryOrder->stockReservations()->sole()->status === StockReservation::Expired, 'Expiry state not persisted.');
    verify($expiryStock->fresh()->quantity === 20 && $expiryStock->fresh()->reserved_quantity === 0 && $expiryStock->fresh()->available_quantity === 20, 'Expiry balances mismatch.');
    verify(app(ExpireStockReservations::class)->execute($expiryOrder) === 0, 'Expiry retry should be a no-op.');
    if (! $transactional) {
        verify(Artisan::call('inventory:expire-reservations') === 0, 'Expiry command retry failed.');
    }
    verify($expiryStock->movements()->where('movement_type', 'RELEASE')->count() === 1, 'Expiry must create exactly one RELEASE movement.');
    $snapshot($expiryOrder);
    $releaseOrder = app(CreateOrder::class)->execute(Customer::factory()->create(), 'CHECK-RELEASE', [
        ['product' => $expiryStock->product, 'quantity' => 2, 'unit_price' => '100.00'],
    ], $address, $address, $expiryStock->warehouse);
    app(ReserveOrderStock::class)->execute($releaseOrder);
    app(TransitionOrderStatus::class)->execute($releaseOrder, 'cancelled');
    verify($expiryStock->fresh()->quantity === 20 && $expiryStock->fresh()->reserved_quantity === 0, 'Cancellation release balances mismatch.');
    $snapshot($releaseOrder);
    fwrite(STDOUT, "PASS: MySQL expiry schema/index, 20/0/20 -> 20/2/18 -> 18/0/18, shipment/delivery unchanged, expiry -> 20/0/20 and retry uniqueness.\n");
    if (in_array('--ui-snapshots', $argv, true)) {
        fwrite(STDOUT, 'UI_SNAPSHOTS:'.json_encode($snapshots, JSON_THROW_ON_ERROR)."\n");
    }
} catch (Throwable $exception) {
    fwrite(STDERR, 'FAIL: '.$exception->getMessage()."\n");
    $exitCode = 1;
} finally {
    Carbon::setTestNow();
    foreach ($processes as $process) {
        if ($process->isRunning()) {
            $process->stop();
        }
    }
    DB::disconnect('inventory_check');
    if ($transactional && DB::connection('mysql')->transactionLevel() > 0) {
        DB::connection('mysql')->rollBack();
        fwrite(STDOUT, "Rolled back all verification records. Existing application records were not mutated. Concurrent worker test requires isolated-database privileges.\n");
    }
    if ($created) {
        $control->statement("DROP DATABASE `{$database}`");
        fwrite(STDOUT, "Removed isolated verification database {$database}. Application data was not modified.\n");
    }
}
exit($exitCode);
