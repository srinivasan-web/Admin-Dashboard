<?php

namespace App\Actions;

use App\Models\Order;
use App\Services\OrderInventoryService;

class ExpireStockReservations
{
    public function __construct(private readonly OrderInventoryService $inventory) {}

    public function execute(Order $order): int
    {
        return $this->inventory->expire($order);
    }
}
