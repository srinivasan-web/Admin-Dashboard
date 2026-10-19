<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->timestamp('warehouse_allocated_at')->nullable();
            $table->foreignUuid('warehouse_allocated_by')->nullable()->constrained('users')->nullOnDelete();
        });
        Schema::table('stock_reservations', function (Blueprint $table): void {
            $table->timestamp('restored_at')->nullable();
        });
        Schema::table('shipments', function (Blueprint $table): void {
            $table->timestamp('in_transit_at')->nullable();
            $table->timestamp('out_for_delivery_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('shipments', fn (Blueprint $table) => $table->dropColumn(['in_transit_at', 'out_for_delivery_at']));
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('warehouse_allocated_by');
            $table->dropColumn('warehouse_allocated_at');
        });
        Schema::table('stock_reservations', fn (Blueprint $table) => $table->dropColumn('restored_at'));
    }
};
