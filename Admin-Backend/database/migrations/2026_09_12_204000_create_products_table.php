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
        Schema::create('products', function (Blueprint $table): void {
            $table->engine = 'InnoDB';
            $table->uuid('id')->primary();
            $table->foreignUuid('brand_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('category_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('product_type_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('hsn_code_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('name');
            $table->string('group_name')->nullable();
            $table->string('sku')->unique();
            $table->decimal('mrp_price', 12, 2);
            $table->decimal('sale_price', 12, 2)->nullable();
            $table->string('tag')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_trade_product')->default(false);
            $table->longText('description')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['product_type_id', 'is_active']);
            $table->index(['is_active', 'sort_order']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
