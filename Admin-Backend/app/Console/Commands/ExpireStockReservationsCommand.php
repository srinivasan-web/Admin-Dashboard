<?php

namespace App\Console\Commands;

use App\Actions\ExpireStockReservations;
use App\Models\Order;
use App\Models\StockReservation;
use Illuminate\Console\Command;
use Throwable;

class ExpireStockReservationsCommand extends Command
{
    protected $signature = 'inventory:expire-reservations';

    protected $description = 'Release overdue active stock reservations without changing physical stock';

    public function handle(ExpireStockReservations $expire): int
    {
        $expired = 0;
        $failed = 0;
        Order::query()->whereHas('stockReservations', fn ($query) => $query
            ->where('status', StockReservation::Active)->where('expires_at', '<=', now()))
            ->chunkById(100, function ($orders) use ($expire, &$expired, &$failed): void {
                foreach ($orders as $order) {
                    try {
                        $expired += $expire->execute($order);
                    } catch (Throwable $exception) {
                        $failed++;
                        report($exception);
                        $this->error("Could not expire reservations for order {$order->id}; see application logs.");
                    }
                }
            });
        $this->info("Expired {$expired} reservation(s); {$failed} order(s) failed.");

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }
}
