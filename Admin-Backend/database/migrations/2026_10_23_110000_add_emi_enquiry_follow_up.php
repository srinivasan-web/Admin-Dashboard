<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('emi_calculations', function (Blueprint $table): void {
            $table->uuid('idempotency_key')->nullable()->unique();
            $table->char('request_fingerprint', 64)->nullable();
            $table->string('notification_status', 20)->default('pending');
            $table->unsignedInteger('notification_attempts')->default(0);
            $table->string('notification_error', 80)->nullable();
            $table->dateTime('notification_locked_until')->nullable();
            $table->dateTime('notified_at')->nullable();
            $table->index(['notification_status', 'updated_at'], 'emi_follow_up_pending');
        });
    }

    public function down(): void
    {
        Schema::table('emi_calculations', function (Blueprint $table): void {
            $table->dropIndex('emi_follow_up_pending');
            $table->dropUnique(['idempotency_key']);
            $table->dropColumn(['idempotency_key', 'request_fingerprint', 'notification_status', 'notification_attempts', 'notification_error', 'notification_locked_until', 'notified_at']);
        });
    }
};
