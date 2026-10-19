<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $connection = DB::connection();
        $driver = $connection->getDriverName();

        if (! in_array($driver, ['mysql', 'mariadb', 'sqlite'], true)) {
            throw new RuntimeException('Stock balance enforcement supports MySQL, MariaDB and SQLite only.');
        }

        if ($driver !== 'sqlite') {
            $minimum = $connection->isMaria() ? '10.2.1' : '8.0.16';
            if (version_compare($connection->getServerVersion(), $minimum, '<')) {
                throw new RuntimeException("Stock balance enforcement requires an enforced CHECK constraint (database version >= {$minimum}).");
            }
        }

        if (DB::table('warehouse_stocks')->where('quantity', '<', 0)
            ->orWhere('reserved_quantity', '<', 0)
            ->orWhereColumn('reserved_quantity', '>', 'quantity')->exists()) {
            throw new RuntimeException('Invalid warehouse stock balances exist. Reconcile physical/reserved stock before migrating; no stock records were changed.');
        }

        if ($driver === 'sqlite') {
            // SQLite cannot ADD CHECK to an existing table. Enforce the same rule
            // without rebuilding a stock table referenced by historical movements.
            foreach (['INSERT', 'UPDATE'] as $operation) {
                $name = 'warehouse_stocks_balance_'.strtolower($operation);
                DB::unprepared("CREATE TRIGGER {$name} BEFORE {$operation} ON warehouse_stocks
                    WHEN NEW.quantity < 0 OR NEW.reserved_quantity < 0 OR NEW.reserved_quantity > NEW.quantity
                    BEGIN SELECT RAISE(ABORT, 'warehouse_stocks_balance_check'); END");
            }

            return;
        }

        DB::statement('ALTER TABLE warehouse_stocks ADD CONSTRAINT warehouse_stocks_balance_check CHECK (quantity >= 0 AND reserved_quantity >= 0 AND reserved_quantity <= quantity)');
    }

    public function down(): void
    {
        $connection = DB::connection();
        if ($connection->getDriverName() === 'sqlite') {
            DB::unprepared('DROP TRIGGER IF EXISTS warehouse_stocks_balance_insert');
            DB::unprepared('DROP TRIGGER IF EXISTS warehouse_stocks_balance_update');

            return;
        }

        $drop = $connection->isMaria() ? 'DROP CONSTRAINT' : 'DROP CHECK';
        DB::statement("ALTER TABLE warehouse_stocks {$drop} warehouse_stocks_balance_check");
    }
};
