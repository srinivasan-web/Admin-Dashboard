<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = collect(['catalog.manage', 'inventory.manage', 'orders.view', 'orders.manage'])
            ->mapWithKeys(fn (string $name): array => [$name => Permission::query()->firstOrCreate(['name' => $name])]);

        $catalogManager = Role::query()->firstOrCreate(
            ['slug' => 'catalog-manager'],
            ['name' => 'Catalog Manager', 'description' => 'Maintains the catalogue and inventory.'],
        );

        $catalogManager->permissions()->sync($permissions->only(['catalog.manage', 'inventory.manage'])->pluck('id')->all());

        $salesManager = Role::query()->firstOrCreate(
            ['slug' => 'sales-manager'],
            ['name' => 'Sales Manager', 'description' => 'Reviews orders and manages their lifecycle.'],
        );

        $salesManager->permissions()->sync($permissions->only(['orders.view', 'orders.manage'])->pluck('id')->all());

        Role::query()
            ->whereIn('slug', ['admin', 'super-admin'])
            ->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching($permissions->pluck('id')->all()));
    }
}
