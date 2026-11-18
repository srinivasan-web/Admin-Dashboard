<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('banners', function (Blueprint $table): void {
            $table->foreignUuid('category_id')->nullable()->after('page')->constrained('categories')->restrictOnDelete();
            $table->foreignUuid('product_type_id')->nullable()->after('category_id')->constrained('product_types')->restrictOnDelete();
            $table->index(['page', 'category_id', 'product_type_id', 'is_active', 'sort_order'], 'banners_listing_target_index');
        });
    }

    public function down(): void
    {
        Schema::table('banners', function (Blueprint $table): void {
            $table->dropIndex('banners_listing_target_index');
            $table->dropConstrainedForeignId('product_type_id');
            $table->dropConstrainedForeignId('category_id');
        });
    }
};
