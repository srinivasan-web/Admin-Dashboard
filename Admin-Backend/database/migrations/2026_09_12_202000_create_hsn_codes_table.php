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
        Schema::create('hsn_codes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->string('type')->nullable();
            $table->string('hsn_code')->nullable()->unique();
            $table->decimal('sgst_tax_multiplier', 5, 2)->nullable();
            $table->decimal('igst_tax_multiplier', 5, 2)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('hsn_codes');
    }
};
