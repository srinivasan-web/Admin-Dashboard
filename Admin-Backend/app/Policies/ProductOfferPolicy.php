<?php

namespace App\Policies;

use App\Models\ProductOffer;
use App\Models\User;

class ProductOfferPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('catalog.manage');
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function update(User $user, ProductOffer $offer): bool
    {
        return $this->viewAny($user);
    }

    public function delete(User $user, ProductOffer $offer): bool
    {
        return $this->viewAny($user);
    }
}
