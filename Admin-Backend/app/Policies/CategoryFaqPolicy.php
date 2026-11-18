<?php

namespace App\Policies;

use App\Models\CategoryFaq;
use App\Models\User;

class CategoryFaqPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('catalog.manage');
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function update(User $user, CategoryFaq $faq): bool
    {
        return $this->viewAny($user);
    }

    public function delete(User $user, CategoryFaq $faq): bool
    {
        return $this->viewAny($user);
    }
}
