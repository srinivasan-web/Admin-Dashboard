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
        Schema::create('orders', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('order_number')->unique();
            $table->foreignUuid('customer_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('warehouse_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('status');
            $table->string('payment_status')->nullable();
            $table->string('fulfillment_status')->nullable();
            $table->decimal('subtotal_amount', 12, 2);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2);
            $table->timestamp('placed_at')->useCurrent();
            $table->timestamps();

            $table->index(['customer_id', 'placed_at']);
            $table->index(['warehouse_id', 'status']);
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
