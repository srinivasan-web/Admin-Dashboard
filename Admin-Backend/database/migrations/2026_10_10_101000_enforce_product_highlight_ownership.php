<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $invalid = DB::table('product_highlights as highlights')
            ->leftJoin('product_attributes as specifications', function ($join): void {
                $join->on('specifications.id', '=', 'highlights.product_attribute_id')
                    ->on('specifications.product_id', '=', 'highlights.product_id');
            })->whereNull('specifications.id')->exists();

        if ($invalid) {
            throw new RuntimeException('Invalid product highlight ownership exists. Reconcile the referenced specifications before migrating; no highlights were changed.');
        }

        // A unique referenced pair is portable and avoids MySQL non-standard-key FKs.
        // Keep this resumable if MySQL committed the index but the following DDL failed.
        if (! Schema::hasIndex('product_attributes', 'product_attributes_product_id_id_unique')) {
            Schema::table('product_attributes', function (Blueprint $table): void {
                $table->unique(['product_id', 'id']);
            });
        }

        $exists = collect(Schema::getForeignKeys('product_highlights'))->contains(
            fn (array $key): bool => $key['columns'] === ['product_id', 'product_attribute_id']
                && $key['foreign_table'] === 'product_attributes'
                && $key['foreign_columns'] === ['product_id', 'id']
        );

        if (! $exists) {
            Schema::table('product_highlights', function (Blueprint $table): void {
                $table->foreign(['product_id', 'product_attribute_id'])
                    ->references(['product_id', 'id'])->on('product_attributes')->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::table('product_highlights', function (Blueprint $table): void {
            $table->dropForeign(['product_id', 'product_attribute_id']);
        });
        Schema::table('product_attributes', function (Blueprint $table): void {
            $table->dropUnique(['product_id', 'id']);
        });
    }
};
