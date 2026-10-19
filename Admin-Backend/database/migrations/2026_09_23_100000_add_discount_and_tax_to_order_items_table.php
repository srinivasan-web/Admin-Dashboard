<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table): void {
            // Historical amounts are unknown, not zero. No recalculation/backfill.
            $table->decimal('discount_amount', 12, 2)->nullable();
            $table->decimal('tax_amount', 12, 2)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table): void {
            $table->dropColumn(['discount_amount', 'tax_amount']);
        });
    }
};
