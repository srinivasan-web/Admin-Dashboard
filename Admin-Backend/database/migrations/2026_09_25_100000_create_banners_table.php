<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('banners', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->foreignUuid('desktop_media_id')->constrained('media')->restrictOnDelete();
            $table->foreignUuid('mobile_media_id')->constrained('media')->restrictOnDelete();
            $table->string('page')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('redirect_url', 2048)->nullable();
            $table->dateTime('start_at')->nullable();
            $table->dateTime('end_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['page', 'is_active', 'sort_order']);
            $table->index(['start_at', 'end_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('banners');
    }
};
