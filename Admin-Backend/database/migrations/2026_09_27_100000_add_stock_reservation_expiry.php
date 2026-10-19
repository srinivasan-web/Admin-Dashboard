<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $ttl = (int) config('inventory.reservation_ttl_minutes');
        if ($ttl < 1) {
            throw new RuntimeException('Inventory reservation TTL must be a positive number of minutes.');
        }

        Schema::table('stock_reservations', function (Blueprint $table): void {
            $table->timestamp('expires_at')->nullable();
            $table->index(['status', 'expires_at'], 'stock_reservations_expiry_index');
        });

        // Preserve historical terminal records. Existing ACTIVE holds receive their original deadline.
        DB::table('stock_reservations')->where('status', 'ACTIVE')->orderBy('id')
            ->chunkById(200, function ($reservations) use ($ttl): void {
                foreach ($reservations as $reservation) {
                    DB::table('stock_reservations')->where('id', $reservation->id)
                        ->where('status', 'ACTIVE')->whereNull('expires_at')
                        ->update(['expires_at' => Carbon::parse($reservation->reserved_at)->addMinutes($ttl)]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('stock_reservations', function (Blueprint $table): void {
            $table->dropIndex('stock_reservations_expiry_index');
            $table->dropColumn('expires_at');
        });
    }
};
