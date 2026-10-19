<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->constrained()->restrictOnDelete();
            // Assignment remains optional until the dispatch requirement is confirmed.
            $table->foreignUuid('warehouse_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('carrier');
            $table->string('tracking_reference')->nullable();
            // Existing vocabulary: pending, processing, shipped, delivered, cancelled.
            $table->string('status');
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();

            $table->index('order_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipments');
    }
};
