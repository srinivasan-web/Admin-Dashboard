<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('emi_providers', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('code', 80)->unique();
            $table->boolean('is_active')->default(false);
            $table->timestamps();
        });
        Schema::create('emi_plans', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('provider_id')->constrained('emi_providers')->restrictOnDelete();
            $table->unsignedSmallInteger('tenure_months');
            $table->decimal('annual_interest_rate', 7, 4)->default(0);
            // A fixed, upfront fee, excluded from financed principal.
            $table->decimal('processing_fee', 12, 2)->default(0);
            $table->decimal('minimum_amount', 12, 2)->default(0);
            $table->decimal('maximum_amount', 12, 2)->nullable();
            // Explicit merchant-funded interest waiver; processing fees still apply.
            $table->boolean('is_no_cost')->default(false);
            $table->dateTime('starts_at')->nullable();
            $table->dateTime('ends_at')->nullable();
            $table->boolean('is_active')->default(false);
            $table->timestamps();
            $table->index(['provider_id', 'is_active', 'tenure_months'], 'emi_provider_eligibility');
        });
        Schema::create('product_emi_plans', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('variant_id')->nullable()->constrained('product_variants')->restrictOnDelete();
            $table->foreignUuid('emi_plan_id')->constrained()->restrictOnDelete();
            $table->boolean('is_active')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            // Non-null generated target makes base-product mappings unique on MySQL too.
            $table->string('target_key', 36)->storedAs('coalesce(variant_id, product_id)');
            $table->unique(['target_key', 'emi_plan_id'], 'emi_unique_target_plan');
            $table->index(['product_id', 'is_active', 'variant_id', 'sort_order'], 'emi_product_eligibility');
        });
        Schema::create('flash_sales', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->boolean('is_active')->default(false);
            $table->timestamps();
            $table->index(['is_active', 'starts_at', 'ends_at'], 'flash_sale_window');
        });
        Schema::create('flash_sale_products', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('flash_sale_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('product_id')->constrained()->restrictOnDelete();
            $table->string('discount_type', 10); // fixed price, percent off, or fixed amount off
            $table->decimal('discount_value', 12, 2);
            $table->boolean('is_active')->default(false);
            $table->timestamps();
            $table->unique(['flash_sale_id', 'product_id']);
            $table->index(['product_id', 'is_active', 'flash_sale_id'], 'flash_product_eligibility');
        });
        Schema::create('emi_calculations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('variant_id')->nullable()->constrained('product_variants')->restrictOnDelete();
            $table->foreignUuid('emi_plan_id')->constrained()->restrictOnDelete();
            // Only consented enquiries are persisted, never routine calculations.
            $table->text('mobile_number'); // encrypted Eloquent cast
            $table->dateTime('consented_at');
            $table->json('quote');
            $table->timestamps();
            $table->index(['product_id', 'created_at']);
        });
    }

    public function down(): void
    {
        foreach (['emi_calculations', 'flash_sale_products', 'flash_sales', 'product_emi_plans', 'emi_plans', 'emi_providers'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
