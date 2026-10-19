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
        Schema::create('product_images', function (Blueprint $table): void {
            $table->engine = 'InnoDB';

            $table->uuid('id')->primary();

            $table->foreignUuid('product_id')
                ->constrained('products')
                ->cascadeOnDelete();

            $table->foreignUuid('media_id')
                ->constrained('media')
                ->restrictOnDelete();

            $table->string('type');

            $table->unsignedInteger('sort_order')->default(0);

            $table->boolean('is_primary')->default(false);

            $table->timestamps();

            $table->unique(['product_id', 'media_id']);

            $table->index([
                'product_id',
                'type',
                'sort_order',
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_images');
    }
};
