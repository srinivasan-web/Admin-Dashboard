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
        Schema::create('order_addresses', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->constrained()->restrictOnDelete();
            $table->string('address_type');
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->text('address');
            $table->string('state')->nullable();
            $table->string('city')->nullable();
            $table->string('postal_code')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['order_id', 'address_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('order_addresses');
    }
};
