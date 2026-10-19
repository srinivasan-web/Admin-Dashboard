<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('warehouse_stocks', function (Blueprint $table): void {
            $table->unsignedInteger('reserved_quantity')->default(0)->after('quantity');
        });

        Schema::create('stock_reservations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('order_item_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignUuid('warehouse_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('product_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('quantity');
            $table->string('status', 20);
            $table->timestamp('reserved_at');
            $table->timestamp('released_at')->nullable();
            $table->timestamp('committed_at')->nullable();
            $table->timestamps();

            $table->index(['order_id', 'status']);
            $table->index(['warehouse_id', 'product_id', 'status']);
        });

        Schema::table('stock_movements', function (Blueprint $table): void {
            // Nullable for the pre-existing manual movement history.
            $table->foreignUuid('warehouse_id')->nullable()->after('warehouse_stock_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('product_id')->nullable()->after('warehouse_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('order_id')->nullable()->after('product_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('order_item_id')->nullable()->after('order_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('quantity')->nullable()->after('quantity_delta');
            $table->string('reference_type')->nullable()->after('quantity');
            $table->uuid('reference_id')->nullable()->after('reference_type');
            $table->string('idempotency_key')->nullable()->unique()->after('reference_id');

            $table->index(['order_id', 'created_at']);
            $table->index(['warehouse_id', 'product_id', 'created_at'], 'stock_movements_stock_audit_index');
        });
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table): void {
            $table->dropIndex('stock_movements_stock_audit_index');
            $table->dropIndex(['order_id', 'created_at']);
            $table->dropUnique(['idempotency_key']);
            $table->dropConstrainedForeignId('order_item_id');
            $table->dropConstrainedForeignId('order_id');
            $table->dropConstrainedForeignId('product_id');
            $table->dropConstrainedForeignId('warehouse_id');
            $table->dropColumn(['quantity', 'reference_type', 'reference_id', 'idempotency_key']);
        });

        Schema::dropIfExists('stock_reservations');

        Schema::table('warehouse_stocks', function (Blueprint $table): void {
            $table->dropColumn('reserved_quantity');
        });
    }
};
