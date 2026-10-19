<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_prices', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->constrained()->restrictOnDelete();
            $table->string('price_type', 20);
            $table->char('currency', 3)->default('INR');
            $table->decimal('amount', 12, 2);
            $table->timestamp('effective_at', 6)->useCurrent();
            $table->timestamp('ends_at', 6)->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['product_id', 'price_type', 'effective_at']);
            $table->index(['product_id', 'price_type', 'ends_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_prices');
    }
};
