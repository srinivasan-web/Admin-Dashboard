<?php

// Read-only query-shape benchmark for a separately seeded MySQL staging schema.

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$options = getopt('', ['samples:', 'analyze']);
$samples = filter_var($options['samples'] ?? '20', FILTER_VALIDATE_INT, ['options' => ['min_range' => 2, 'max_range' => 100]]);
$database = DB::connection()->getDatabaseName();
if ($samples === false || ! $app->environment('testing') || DB::getDriverName() !== 'mysql'
    || ! preg_match('/^durafit_bench_[a-z0-9_]+$/D', (string) $database)) {
    fwrite(STDERR, "Requires APP_ENV=testing and an isolated MySQL database named durafit_bench_*.\n");
    exit(1);
}
if (DB::table('products')->count() < 1000000 || DB::table('orders')->count() < 1000000) {
    fwrite(STDERR, "Requires at least one million products and one million orders. Run the guarded staging seeder first.\n");
    exit(1);
}

DB::statement('SET SESSION MAX_EXECUTION_TIME = 10000');
$categoryId = DB::table('categories')->where('slug', 'benchmark-category-1')->value('id');
$warehouseId = DB::table('warehouses')->where('name', 'Benchmark Warehouse 1')->value('id');
$productId = DB::table('products')->where('sku', 'BENCH-000000001')->value('id');
$attributeId = DB::table('attributes')->where('slug', 'benchmark-motor')->value('id');
if (! $categoryId || ! $warehouseId || ! $productId || ! $attributeId) {
    fwrite(STDERR, "Benchmark fixture master rows are missing.\n");
    exit(1);
}

$queries = [
    'catalog_category' => [
        'SELECT id, name, sku FROM products WHERE is_active = 1 AND category_id = ? ORDER BY sort_order, name, id LIMIT 24',
        [$categoryId],
    ],
    'order_date_before' => [
        'SELECT id, order_number FROM orders WHERE status = ? AND DATE(placed_at) >= ? ORDER BY placed_at DESC, id DESC LIMIT 20',
        ['pending', '2026-06-01'],
    ],
    'order_date_after' => [
        'SELECT id, order_number FROM orders WHERE status = ? AND placed_at >= ? ORDER BY placed_at DESC, id DESC LIMIT 20',
        ['pending', '2026-06-01 00:00:00'],
    ],
    'movement_join_before' => [
        'SELECT m.id, m.movement_type FROM stock_movements m WHERE EXISTS (SELECT 1 FROM warehouse_stocks s WHERE s.id = m.warehouse_stock_id AND s.warehouse_id = ?) ORDER BY m.created_at DESC, m.id DESC LIMIT 20',
        [$warehouseId],
    ],
    'movement_direct_candidate' => [
        'SELECT id, movement_type FROM stock_movements WHERE warehouse_id = ? ORDER BY created_at DESC, id DESC LIMIT 20',
        [$warehouseId],
    ],
    'price_current' => [
        'SELECT id, amount FROM product_prices WHERE product_id = ? AND price_type = ? AND ends_at IS NULL ORDER BY effective_at DESC LIMIT 1',
        [$productId, 'mrp'],
    ],
    'specification_facets' => [
        'SELECT DISTINCT value FROM product_attributes WHERE attribute_id = ? ORDER BY value LIMIT 100',
        [$attributeId],
    ],
];

function benchmarkPercentile(array $values, float $fraction): float
{
    sort($values);
    return round($values[(int) ceil(count($values) * $fraction) - 1], 3);
}

function handlerReads(): array
{
    $status = DB::select("SHOW SESSION STATUS LIKE 'Handler_read%'");
    $result = [];
    foreach ($status as $entry) {
        $result[$entry->Variable_name] = (int) $entry->Value;
    }
    return $result;
}

$report = [
    'database' => $database,
    'measured_at_utc' => gmdate('c'),
    'samples_per_query' => $samples,
    'notes' => 'Sequential SELECT-only timings; handler reads are a row-access proxy, not exact rows examined. No HTTP, concurrency, lock waits, or write throughput measured here.',
    'table_storage' => DB::select(
        "SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('products', 'orders', 'stock_movements', 'product_attributes', 'product_prices', 'warehouse_stocks', 'stock_reservations') ORDER BY TABLE_NAME",
        [$database],
    ),
    'queries' => [],
];

foreach ($queries as $name => [$sql, $bindings]) {
    $plan = DB::select('EXPLAIN FORMAT=JSON '.$sql, $bindings);
    $durations = [];
    $readsBefore = handlerReads();
    for ($sample = 0; $sample < $samples; $sample++) {
        $started = hrtime(true);
        DB::select($sql, $bindings);
        $durations[] = (hrtime(true) - $started) / 1e6;
    }
    $readsAfter = handlerReads();
    $handlerDeltas = [];
    foreach ($readsAfter as $key => $value) {
        $handlerDeltas[$key] = $value - ($readsBefore[$key] ?? 0);
    }
    $report['queries'][$name] = [
        'p50_ms' => benchmarkPercentile($durations, 0.50),
        'p95_ms' => benchmarkPercentile($durations, 0.95),
        'p99_ms' => benchmarkPercentile($durations, 0.99),
        'sequential_queries_per_second' => round($samples / max(array_sum($durations) / 1000, 0.000001), 2),
        'handler_reads' => $handlerDeltas,
        'explain_json' => json_decode($plan[0]->EXPLAIN ?? '{}', true),
    ];
    if (isset($options['analyze'])) {
        // EXPLAIN ANALYZE executes this bounded SELECT; only run on isolated staging.
        $report['queries'][$name]['explain_analyze'] = DB::select('EXPLAIN ANALYZE '.$sql, $bindings);
    }
}

echo json_encode($report, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR).PHP_EOL;
