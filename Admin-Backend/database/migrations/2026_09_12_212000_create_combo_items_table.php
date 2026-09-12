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
        Schema::create('combo_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('combo_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('product_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('quantity')->default(1);
            $table->timestamps();

            $table->unique(['combo_id', 'product_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('combo_items');
    }
};
