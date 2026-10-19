<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_details', function (Blueprint $table): void {
            $table->engine = 'InnoDB';
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->longText('content');
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(false);
            $table->timestamps();
        });

        Schema::create('product_additional_details', function (Blueprint $table): void {
            $table->engine = 'InnoDB';
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('generic_name')->nullable();
            $table->string('model_number')->nullable();
            $table->string('net_quantity')->nullable();
            $table->string('country_of_origin')->nullable();
            $table->text('manufactured_by')->nullable();
            $table->text('marketed_by')->nullable();
            $table->text('consumer_complaints')->nullable();
            $table->timestamps();
        });

        Schema::create('product_additional_benefits', function (Blueprint $table): void {
            $table->engine = 'InnoDB';
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->foreignUuid('icon_media_id')->nullable()->constrained('media')->restrictOnDelete();
            $table->string('benefit_type', 50);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(false);
            $table->timestamps();
        });

        // Distinct concepts in the reference workbook; never merge their content.
        foreach (['shop_benefits', 'why_choose_us'] as $name) {
            Schema::create($name, function (Blueprint $table): void {
                $table->engine = 'InnoDB';
                $table->uuid('id')->primary();
                $table->string('title');
                $table->text('description')->nullable();
                $table->foreignUuid('icon_media_id')->nullable()->constrained('media')->restrictOnDelete();
                $table->unsignedInteger('sort_order')->default(0);
                $table->boolean('is_active')->default(false);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        // These tables own content, not order/payment history. Export content first.
        foreach (['why_choose_us', 'shop_benefits', 'product_additional_benefits', 'product_additional_details', 'product_details'] as $name) {
            Schema::dropIfExists($name);
        }
    }
};
