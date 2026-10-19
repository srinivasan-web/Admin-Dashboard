<?php

namespace App\Actions;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use LogicException;

class RegisterInitialCatalogManager
{
    /** @param array{name: string, email: string, password: string} $data */
    public function execute(array $data): User
    {
        return DB::transaction(function () use ($data): User {
            $role = Role::query()->where('slug', 'catalog-manager')->lockForUpdate()->first();

            if ($role === null) {
                throw new LogicException('The catalog-manager role must be seeded before initial registration.');
            }

            if (User::query()->lockForUpdate()->exists()) {
                throw new LogicException('Initial admin registration is closed.');
            }

            $user = User::query()->create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
            ]);

            $user->roles()->attach($role->id);

            return $user;
        });
    }
}
