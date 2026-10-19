<?php

// Opt-in, append-only synthetic fixture for an EMPTY, separately migrated MySQL schema.
// Never point this script at a production or shared application database.

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$options = getopt('', ['rows:', 'batch:']);
$rows = filter_var($options['rows'] ?? '1000000', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 2000000]]);
$batchSize = filter_var($options['batch'] ?? '200', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 500]]);
$database = DB::connection()->getDatabaseName();
if ($rows === false || $batchSize === false || ! $app->environment('testing')
    || DB::getDriverName() !== 'mysql'
    || ! preg_match('/^durafit_bench_[a-z0-9_]+$/D', (string) $database)
    || getenv('DURAFIT_BENCHMARK_CONFIRM') !== 'seed-isolated-mysql') {
    fwrite(STDERR, "Refusing to seed: use APP_ENV=testing, an isolated MySQL database named durafit_bench_*, and DURAFIT_BENCHMARK_CONFIRM=seed-isolated-mysql.\n");
    exit(1);
}

$tables = [
    'brands', 'categories', 'product_types', 'attributes', 'warehouses', 'customers',
    'products', 'product_prices', 'product_attributes', 'warehouse_stocks',
    'orders', 'order_items', 'stock_reservations', 'stock_movements',
];
foreach ($tables as $table) {
    if (! Schema::hasTable($table) || DB::table($table)->exists()) {
        fwrite(STDERR, "Refusing to seed: {$table} is missing or not empty. Apply migrations to a new isolated benchmark database first.\n");
        exit(1);
    }
}
if (! Schema::hasColumn('stock_reservations', 'expires_at')) {
    fwrite(STDERR, "Refusing to seed: stock reservation expiry migration is missing.\n");
    exit(1);
}

function benchmarkUuid(int $domain, int $number): string
{
    return sprintf('%08x-0000-4000-8000-%012x', $domain, $number);
}

$now = '2026-10-16 00:00:00';
$brandId = benchmarkUuid(11, 1);
$typeId = benchmarkUuid(12, 1);
$attributeId = benchmarkUuid(13, 1);
$customerId = benchmarkUuid(14, 1);
$categoryIds = array_map(fn (int $number): string => benchmarkUuid(15, $number), range(1, 10));
$warehouseIds = array_map(fn (int $number): string => benchmarkUuid(16, $number), range(1, 5));

DB::transaction(function () use ($now, $brandId, $typeId, $attributeId, $customerId, $categoryIds, $warehouseIds): void {
    DB::table('brands')->insert(['id' => $brandId, 'name' => 'Benchmark Brand', 'slug' => 'benchmark-brand', 'created_at' => $now, 'updated_at' => $now]);
    DB::table('product_types')->insert(['id' => $typeId, 'name' => 'Benchmark Equipment', 'slug' => 'benchmark-equipment', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now]);
    DB::table('attributes')->insert(['id' => $attributeId, 'name' => 'Benchmark Motor', 'slug' => 'benchmark-motor', 'data_type' => 'text', 'is_filterable' => true, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now]);
    DB::table('customers')->insert(['id' => $customerId, 'name' => 'Benchmark Customer', 'created_at' => $now, 'updated_at' => $now]);
    foreach ($categoryIds as $index => $id) {
        DB::table('categories')->insert(['id' => $id, 'name' => 'Benchmark Category '.($index + 1), 'slug' => 'benchmark-category-'.($index + 1), 'is_active' => true, 'created_at' => $now, 'updated_at' => $now]);
    }
    foreach ($warehouseIds as $index => $id) {
        DB::table('warehouses')->insert(['id' => $id, 'name' => 'Benchmark Warehouse '.($index + 1), 'created_at' => $now, 'updated_at' => $now]);
    }
});

$started = hrtime(true);
for ($start = 1; $start <= $rows; $start += $batchSize) {
    $products = $stocks = $attributes = $prices = $orders = $items = $reservations = $movements = [];
    $end = min($start + $batchSize - 1, $rows);
    for ($number = $start; $number <= $end; $number++) {
        $productId = benchmarkUuid(1, $number);
        $stockId = benchmarkUuid(2, $number);
        $orderId = benchmarkUuid(3, $number);
        $itemId = benchmarkUuid(4, $number);
        $reservationId = benchmarkUuid(5, $number);
        $categoryId = $categoryIds[$number <= intdiv($rows, 2) ? 0 : ($number % count($categoryIds))];
        $warehouseId = $warehouseIds[$number % count($warehouseIds)];
        $sku = sprintf('BENCH-%09d', $number);
        $placedAt = gmdate('Y-m-d H:i:s', strtotime('2026-01-01 00:00:00 UTC') + ($number % 25000000));

        $products[] = [
            'id' => $productId, 'brand_id' => $brandId, 'category_id' => $categoryId,
            'product_type_id' => $typeId, 'name' => 'Benchmark Product '.$number,
            'sku' => $sku, 'mrp_price' => '1000.00', 'sale_price' => '800.00',
            'sort_order' => $number % 100, 'is_active' => $number % 20 !== 0,
            'created_at' => $placedAt, 'updated_at' => $placedAt,
        ];
        $stocks[] = [
            'id' => $stockId, 'warehouse_id' => $warehouseId, 'product_id' => $productId,
            'quantity' => 10, 'reserved_quantity' => 1,
            'created_at' => $placedAt, 'updated_at' => $placedAt,
        ];
        $attributes[] = [
            'id' => benchmarkUuid(6, $number), 'product_id' => $productId,
            'attribute_id' => $attributeId, 'value' => (($number % 20) + 1).' HP',
            'sort_order' => 0, 'show_on_top' => false,
            'created_at' => $placedAt, 'updated_at' => $placedAt,
        ];
        $prices[] = [
            'id' => benchmarkUuid(7, $number), 'product_id' => $productId,
            'price_type' => 'mrp', 'currency' => 'INR', 'amount' => '1100.00',
            'effective_at' => '2025-01-01 00:00:00', 'ends_at' => '2026-01-01 00:00:00',
            'created_at' => $placedAt, 'updated_at' => $placedAt,
        ];
        $prices[] = [
            'id' => benchmarkUuid(8, $number), 'product_id' => $productId,
            'price_type' => 'mrp', 'currency' => 'INR', 'amount' => '1000.00',
            'effective_at' => '2026-01-01 00:00:00', 'ends_at' => null,
            'created_at' => $placedAt, 'updated_at' => $placedAt,
        ];
        $orders[] = [
            'id' => $orderId, 'order_number' => sprintf('BENCH-ORDER-%09d', $number),
            'customer_id' => $customerId, 'warehouse_id' => $warehouseId,
            'status' => 'pending', 'payment_status' => 'pending', 'fulfillment_status' => 'pending',
            'subtotal_amount' => '800.00', 'discount_amount' => '0.00', 'total_amount' => '800.00',
            'placed_at' => $placedAt, 'created_at' => $placedAt, 'updated_at' => $placedAt,
        ];
        $items[] = [
            'id' => $itemId, 'order_id' => $orderId, 'product_id' => $productId,
            'product_name' => 'Benchmark Product '.$number, 'product_sku' => $sku,
            'quantity' => 1, 'unit_price' => '800.00', 'line_total' => '800.00',
            'created_at' => $placedAt, 'updated_at' => $placedAt,
        ];
        $reservations[] = [
            'id' => $reservationId, 'order_id' => $orderId, 'order_item_id' => $itemId,
            'warehouse_id' => $warehouseId, 'product_id' => $productId,
            'quantity' => 1, 'status' => 'ACTIVE', 'reserved_at' => $placedAt,
            'expires_at' => '2030-01-01 00:00:00', 'created_at' => $placedAt, 'updated_at' => $placedAt,
        ];
        $movements[] = [
            'id' => benchmarkUuid(9, $number), 'warehouse_stock_id' => $stockId,
            'warehouse_id' => $warehouseId, 'product_id' => $productId,
            'order_id' => $orderId, 'order_item_id' => $itemId,
            'movement_type' => 'RESERVE', 'quantity_delta' => 0, 'quantity' => 1,
            'reference_type' => 'stock_reservation', 'reference_id' => $reservationId,
            'idempotency_key' => 'BENCH-RESERVE-'.$number, 'created_at' => $placedAt,
        ];
    }

    DB::transaction(function () use ($products, $stocks, $attributes, $prices, $orders, $items, $reservations, $movements): void {
        DB::table('products')->insert($products);
        DB::table('warehouse_stocks')->insert($stocks);
        DB::table('product_attributes')->insert($attributes);
        DB::table('product_prices')->insert($prices);
        DB::table('orders')->insert($orders);
        DB::table('order_items')->insert($items);
        DB::table('stock_reservations')->insert($reservations);
        DB::table('stock_movements')->insert($movements);
    });
    if ($end % 10000 === 0 || $end === $rows) {
        $seconds = max((hrtime(true) - $started) / 1e9, 0.001);
        fwrite(STDERR, sprintf("Seeded %d/%d products and orders; %.0f product rows/s\n", $end, $rows, $end / $seconds));
    }
}

echo json_encode(['database' => $database, 'products' => $rows, 'orders' => $rows,
    'stock_movements' => $rows, 'product_attributes' => $rows, 'product_prices' => $rows * 2,
    'elapsed_seconds' => round((hrtime(true) - $started) / 1e9, 3)], JSON_THROW_ON_ERROR).PHP_EOL;
