<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_operation_receipts', function (Blueprint $table): void {
            $table->uuid('idempotency_key')->primary();
            $table->foreignUuid('warehouse_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('product_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('operation', 20);
            $table->unsignedInteger('quantity');
            $table->timestamp('created_at');
            $table->index(['warehouse_id', 'product_id']);
        });
    }

    public function down(): void
    {
        // Roll back only after disabling keyed clients and draining in-flight
        // operations: removing receipts removes their replay protection.
        Schema::dropIfExists('inventory_operation_receipts');
    }
};
