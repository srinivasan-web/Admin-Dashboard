<?php

namespace App\Actions;

use App\Models\Order;
use App\Models\User;
use App\Services\OrderInventoryService;

class ReserveOrderStock
{
    public function __construct(private readonly OrderInventoryService $inventory) {}

    public function execute(Order $order, ?User $actor = null): Order
    {
        return $this->inventory->reserve($order, $actor);
    }
}
