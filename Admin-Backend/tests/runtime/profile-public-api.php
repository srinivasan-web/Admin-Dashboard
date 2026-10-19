<?php

// Read-only local diagnostics. No application hooks, persistent query logs or data writes.

use Illuminate\Contracts\Http\Kernel;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

$started = hrtime(true);
require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();
$bootMs = (hrtime(true) - $started) / 1_000_000;

if (! $app->environment(['local', 'testing'])) {
    fwrite(STDERR, "This profiler is restricted to local/testing environments.\n");
    exit(1);
}

$options = getopt('', ['samples:', 'http:', 'explain']);
$samples = filter_var($options['samples'] ?? 20, FILTER_VALIDATE_INT, ['options' => ['min_range' => 2, 'max_range' => 100]]);
if ($samples === false) {
    fwrite(STDERR, "Use --samples=2..100.\n");
    exit(1);
}
$http = $options['http'] ?? null;
if ($http !== null) {
    $url = parse_url($http);
    if (! is_array($url) || ($url['scheme'] ?? '') !== 'http'
        || ! in_array($url['host'] ?? '', ['127.0.0.1', 'localhost', '[::1]'], true)
        || ! in_array($url['path'] ?? '', ['', '/'], true)
        || isset($url['user']) || isset($url['pass']) || isset($url['query']) || isset($url['fragment'])
        || ! extension_loaded('curl')) {
        fwrite(STDERR, "HTTP mode requires cURL and a loopback HTTP origin, e.g. --http=http://127.0.0.1:8000.\n");
        exit(1);
    }
}

function percentiles(array $values): array
{
    sort($values);
    $result = [];
    foreach (['p50' => 0.5, 'p95' => 0.95, 'p99' => 0.99] as $key => $percentile) {
        $result[$key] = round($values[(int) ceil(count($values) * $percentile) - 1], 3);
    }

    return $result;
}

$queries = [];
if ($http === null) {
    DB::listen(function (QueryExecuted $query) use (&$queries): void {
        $queries[] = ['sql' => $query->sql, 'bindings' => $query->bindings, 'ms' => $query->time];
    });
}

$report = [
    'measured_at_utc' => gmdate('c'),
    'mode' => $http === null ? 'warm_kernel' : 'http',
    'php_version' => PHP_VERSION,
    'profiler_boot_ms' => round($bootMs, 3),
    'concurrency' => 1,
    'notes' => 'Small-sample diagnostics; not a capacity test. HTTP mode includes Laravel bootstrap and transport; warm_kernel mode reuses booted Laravel. Media downloads are not included.',
    'endpoints' => [],
];

if ($http === null) {
    $connectStarted = hrtime(true);
    DB::connection()->getPdo();
    $report['connection_ms'] = round((hrtime(true) - $connectStarted) / 1_000_000, 3);
    $report['driver'] = DB::getDriverName();
    $report['table_counts'] = [];
    foreach (['categories', 'products', 'warehouse_stocks', 'attributes', 'product_attributes', 'merchandising_products'] as $table) {
        $report['table_counts'][$table] = DB::table($table)->count();
    }
}

$failed = false;
foreach (['categories', 'products', 'merchandising/bestsellers', 'merchandising/featured', 'filters'] as $endpoint) {
    $durations = $sqlTimes = $queryCounts = $peaks = $hashes = $firstQueries = [];
    $slowestQuery = null;
    $errors = 0;
    $body = '';
    for ($sample = 0; $sample < $samples; $sample++) {
        $queries = [];
        $memoryBefore = memory_get_usage();
        memory_reset_peak_usage();
        $start = hrtime(true);
        if ($http !== null) {
            $handle = curl_init(rtrim($http, '/').'/api/v1/'.$endpoint);
            curl_setopt_array($handle, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 5,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_HTTPHEADER => ['Accept: application/json'],
            ]);
            $body = (string) curl_exec($handle);
            $status = curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
            curl_close($handle);
        } else {
            $request = Request::create('/api/v1/'.$endpoint, 'GET', [], [], [], ['HTTP_ACCEPT' => 'application/json']);
            $response = $kernel->handle($request);
            $body = (string) $response->getContent();
            $status = $response->getStatusCode();
            $kernel->terminate($request, $response);
        }
        $durations[] = (hrtime(true) - $start) / 1_000_000;
        $sqlTimes[] = array_sum(array_column($queries, 'ms'));
        foreach ($queries as $query) {
            if ($slowestQuery === null || $query['ms'] > $slowestQuery['ms']) {
                $slowestQuery = ['sql' => $query['sql'], 'ms' => $query['ms']];
            }
        }
        $queryCounts[] = count($queries);
        $peaks[] = max(0, memory_get_peak_usage() - $memoryBefore) / 1024 / 1024;
        $hashes[] = hash('sha256', $body);
        if ($sample === 0) {
            $firstQueries = $queries;
        }
        if ($status !== 200) {
            $errors++;
            $failed = true;
            break;
        }
    }
    $result = [
        'samples' => count($durations),
        'first_request_ms' => round($durations[0], 3),
        'request_ms' => percentiles($durations),
        'requests_per_second' => round(count($durations) / max(array_sum($durations) / 1000, 0.000001), 3),
        'errors' => $errors,
        'error_rate' => $errors / count($durations),
        'response_bytes' => strlen($body),
        'response_hashes' => array_values(array_unique($hashes)),
    ];
    if ($http === null) {
        $result['sql_ms'] = percentiles($sqlTimes);
        $result['query_counts'] = array_values(array_unique($queryCounts));
        $result['slowest_query'] = $slowestQuery;
        $result['request_peak_mib'] = percentiles($peaks);
        $result['first_request_queries'] = array_map(function (array $query) use ($options): array {
            $entry = ['sql' => $query['sql'], 'ms' => $query['ms']];
            if (isset($options['explain']) && DB::getDriverName() === 'mysql' && preg_match('/^select\s/i', $query['sql'])) {
                $entry['explain'] = DB::select('EXPLAIN '.$query['sql'], $query['bindings']);
            }

            return $entry;
        }, $firstQueries);
    }
    $report['endpoints']['/api/v1/'.$endpoint] = $result;
    if ($failed) {
        break;
    }
}

echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR).PHP_EOL;
exit($failed ? 1 : 0);
