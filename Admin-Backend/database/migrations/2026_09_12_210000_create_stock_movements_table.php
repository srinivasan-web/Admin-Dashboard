<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('warehouse_stock_id')->constrained()->restrictOnDelete();
            $table->string('movement_type');
            $table->integer('quantity_delta');
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['warehouse_stock_id', 'created_at']);
            $table->index('movement_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
