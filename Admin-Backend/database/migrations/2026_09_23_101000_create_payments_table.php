<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->constrained()->restrictOnDelete();
            $table->string('provider');
            $table->string('provider_transaction_reference');
            $table->decimal('amount', 12, 2);
            $table->char('currency', 3);
            // Existing vocabulary: pending, authorized, paid, failed, refunded.
            $table->string('status');
            $table->timestamps();

            $table->unique(['provider', 'provider_transaction_reference']);
            $table->index('order_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
