<?php

namespace App\Policies;

use App\Models\ShopBenefit;
use App\Models\User;

class ShopBenefitPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('catalog.manage');
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function update(User $user, ShopBenefit $benefit): bool
    {
        return $this->viewAny($user);
    }

    public function delete(User $user, ShopBenefit $benefit): bool
    {
        return $this->viewAny($user);
    }
}
