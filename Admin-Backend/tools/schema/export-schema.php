<?php

// Metadata only: no application rows, credentials, session tokens or personal data.
// --scratch migrates an isolated in-memory SQLite connection, NEVER the configured DB.
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

require dirname(__DIR__, 2).'/vendor/autoload.php';
chdir(dirname(__DIR__, 2));

$options = getopt('', ['scratch', 'output:']);
if (! isset($options['output'])) {
    fwrite(STDERR, "Usage: php tools/schema/export-schema.php [--scratch] --output=metadata.json\n");
    exit(2);
}
$app = require 'bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

if (isset($options['scratch'])) {
    config(['database.default' => 'schema_scratch', 'database.connections.schema_scratch' => [
        'driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true,
    ]]);
    DB::purge('schema_scratch');
    if (DB::connection()->getDatabaseName() !== ':memory:') {
        throw new RuntimeException('Refusing non-memory scratch database.');
    }
    if (Artisan::call('migrate', ['--database' => 'schema_scratch', '--force' => true]) !== 0) {
        throw new RuntimeException(Artisan::output());
    }
}

$schema = Schema::connection(DB::getDefaultConnection());
$result = [
    'generated_at' => gmdate('c'),
    'mode' => isset($options['scratch']) ? 'isolated-migration-projection' : 'read-only-runtime',
    'driver' => DB::connection()->getDriverName(),
    'version' => DB::connection()->getPdo()->getAttribute(PDO::ATTR_SERVER_VERSION),
    'laravel' => $app->version(),
    'tables' => [],
    'migrations' => [],
];
foreach ($schema->getTables() as $table) {
    $name = $table['name'];
    $result['tables'][$name] = [
        'columns' => $schema->getColumns($name),
        'indexes' => $schema->getIndexes($name),
        'foreign_keys' => $schema->getForeignKeys($name),
    ];
}
if ($schema->hasTable('migrations')) {
    $applied = DB::table('migrations')->pluck('migration')->all();
    foreach (glob(database_path('migrations/*.php')) as $file) {
        $migration = basename($file, '.php');
        $result['migrations'][$migration] = in_array($migration, $applied, true) ? 'applied' : 'pending';
    }
}
file_put_contents($options['output'], json_encode($result, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR).PHP_EOL);
echo $result['mode'].'; '.$result['driver'].' '.$result['version'].'; '.count($result['tables'])." tables exported (metadata only).\n";
