<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Nullable additions preserve all existing API writes and historical products.
        // Do not manufacture slugs or summaries from existing names/descriptions.
        Schema::table('products', function (Blueprint $table): void {
            $table->string('slug')->nullable()->unique();
            $table->text('short_description')->nullable();
        });

        Schema::table('product_images', function (Blueprint $table): void {
            $table->string('alt_text')->nullable();
        });
    }

    public function down(): void
    {
        // Export populated metadata before rollback; catalog identifiers remain untouched.
        Schema::table('product_images', fn (Blueprint $table) => $table->dropColumn('alt_text'));
        Schema::table('products', function (Blueprint $table): void {
            $table->dropUnique(['slug']);
            $table->dropColumn(['slug', 'short_description']);
        });
    }
};
