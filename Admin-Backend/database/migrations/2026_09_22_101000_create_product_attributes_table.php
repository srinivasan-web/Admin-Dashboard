<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_attributes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('attribute_id')->constrained('attributes')->restrictOnDelete();
            $table->text('value');
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('show_on_top')->default(false);
            $table->timestamps();
            $table->unique(['product_id', 'attribute_id']);
            $table->index(['product_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_attributes');
    }
};
