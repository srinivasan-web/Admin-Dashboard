<?php

namespace App\Actions;

use App\Models\Order;
use App\Services\OrderInventoryService;

class RestoreCancelledOrderStock
{
    public function __construct(private readonly OrderInventoryService $inventory) {}

    public function execute(Order $order): Order
    {
        return $this->inventory->restoreCancellation($order);
    }
}
