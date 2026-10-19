<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Separate foreign keys prove existence, not that these records belong together.
        // Check all legacy rows before DDL; never rewrite stock or historical ownership.
        $invalidItem = DB::table('stock_reservations as reservations')
            ->leftJoin('order_items as items', function ($join): void {
                $join->on('items.id', '=', 'reservations.order_item_id')
                    ->on('items.order_id', '=', 'reservations.order_id')
                    ->on('items.product_id', '=', 'reservations.product_id');
            })->whereNull('items.id')->exists();

        $invalidStock = DB::table('stock_reservations as reservations')
            ->leftJoin('warehouse_stocks as stocks', function ($join): void {
                $join->on('stocks.warehouse_id', '=', 'reservations.warehouse_id')
                    ->on('stocks.product_id', '=', 'reservations.product_id');
            })->whereNull('stocks.id')->exists();

        if ($invalidItem || $invalidStock) {
            throw new RuntimeException('Invalid stock reservation relationships exist. Reconcile order item/product ownership and warehouse stock references before migrating; no records were changed.');
        }

        // MySQL DDL can commit before migration bookkeeping. Allow a safe retry.
        if (! Schema::hasIndex('order_items', 'order_items_order_id_id_product_id_unique')) {
            Schema::table('order_items', function (Blueprint $table): void {
                $table->unique(['order_id', 'id', 'product_id']);
            });
        }

        if (! $this->hasForeignKey(['order_id', 'order_item_id', 'product_id'], 'order_items', ['order_id', 'id', 'product_id'])) {
            Schema::table('stock_reservations', function (Blueprint $table): void {
                $table->foreign(['order_id', 'order_item_id', 'product_id'])
                    ->references(['order_id', 'id', 'product_id'])->on('order_items')
                    ->restrictOnDelete()->restrictOnUpdate();
            });
        }

        if (! $this->hasForeignKey(['warehouse_id', 'product_id'], 'warehouse_stocks', ['warehouse_id', 'product_id'])) {
            Schema::table('stock_reservations', function (Blueprint $table): void {
                $table->foreign(['warehouse_id', 'product_id'])
                    ->references(['warehouse_id', 'product_id'])->on('warehouse_stocks')
                    ->restrictOnDelete()->restrictOnUpdate();
            });
        }
    }

    public function down(): void
    {
        Schema::table('stock_reservations', function (Blueprint $table): void {
            $table->dropForeign(['warehouse_id', 'product_id']);
            $table->dropForeign(['order_id', 'order_item_id', 'product_id']);
        });

        Schema::table('order_items', function (Blueprint $table): void {
            $table->dropUnique(['order_id', 'id', 'product_id']);
        });
    }

    private function hasForeignKey(array $columns, string $table, array $references): bool
    {
        return collect(Schema::getForeignKeys('stock_reservations'))->contains(
            fn (array $key): bool => $key['columns'] === $columns
                && $key['foreign_table'] === $table
                && $key['foreign_columns'] === $references
        );
    }
};
