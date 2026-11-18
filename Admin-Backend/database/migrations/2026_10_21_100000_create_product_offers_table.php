<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_offers', function (Blueprint $table): void {
            $table->engine = 'InnoDB';
            $table->uuid('id')->primary();
            $table->string('scope_type', 20);
            $table->foreignUuid('product_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignUuid('category_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignUuid('product_type_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('offer_type', 20);
            $table->string('coupon_code', 80)->nullable()->unique();
            $table->string('discount_type', 20)->nullable();
            $table->decimal('discount_value', 12, 2)->nullable();
            $table->decimal('maximum_discount', 12, 2)->nullable();
            $table->decimal('minimum_order_amount', 12, 2)->nullable();
            $table->dateTime('starts_at')->nullable();
            $table->dateTime('ends_at')->nullable();
            $table->boolean('is_active')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['product_id', 'is_active', 'starts_at', 'ends_at'], 'offers_product_visibility');
            $table->index(['category_id', 'is_active', 'starts_at', 'ends_at'], 'offers_category_visibility');
            $table->index(['product_type_id', 'is_active', 'starts_at', 'ends_at'], 'offers_type_visibility');
        });

        // MySQL 8 enforces the same scope invariant as the request validator.
        // SQLite feature tests exercise the request rule; ALTER TABLE CHECK is
        // unavailable on SQLite after CREATE TABLE.
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE product_offers ADD CONSTRAINT offers_scope_target_check CHECK (
                (scope_type = 'product' AND product_id IS NOT NULL AND category_id IS NULL AND product_type_id IS NULL)
                OR (scope_type = 'category' AND category_id IS NOT NULL AND product_id IS NULL AND product_type_id IS NULL)
                OR (scope_type = 'product_type' AND product_type_id IS NOT NULL AND product_id IS NULL AND category_id IS NULL)
            )");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('product_offers');
    }
};
