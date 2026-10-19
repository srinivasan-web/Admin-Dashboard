<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Warehouse;

class WarehousePolicy
{
    public function update(User $user, Warehouse $warehouse): bool
    {
        return $user->hasPermission('inventory.manage');
    }
}
