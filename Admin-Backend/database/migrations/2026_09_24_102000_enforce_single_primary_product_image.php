<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
{
    $hasDuplicatePrimaryImages = DB::table('product_images')
        ->select('product_id')
        ->where('is_primary', true)
        ->groupBy('product_id')
        ->havingRaw('COUNT(*) > 1')
        ->exists();

    if ($hasDuplicatePrimaryImages) {
        throw new RuntimeException(
            'Resolve duplicate primary product images before applying this migration. No images were changed.'
        );
    }

    Schema::table('product_images', function (Blueprint $table): void {
        $table->uuid('primary_product_id')->nullable()
            ->virtualAs('CASE WHEN is_primary = 1 THEN product_id ELSE NULL END');

        $table->unique('primary_product_id');
    });
}
};
