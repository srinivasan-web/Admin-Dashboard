<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AttributeAdminApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_catalog_manager_can_create_list_edit_and_deactivate_an_attribute(): void
    {
        $permission = Permission::query()->create(['name' => 'catalog.manage']);
        $role = Role::query()->create(['name' => 'Catalog Manager', 'slug' => 'catalog-manager']);
        $role->permissions()->attach($permission);
        $manager = User::factory()->create();
        $manager->roles()->attach($role);
        $this->actingAs($manager);

        $created = $this->postJson('/api/v1/admin/attributes', [
            'name' => 'Motor',
            'data_type' => 'text',
            'unit' => 'HP',
            'is_filterable' => true,
            'is_active' => true,
            'sort_order' => 2,
        ])->assertCreated()->assertJsonPath('data.slug', 'motor')->json('data');

        $this->getJson('/api/v1/admin/attributes')
            ->assertOk()->assertJsonPath('data.0.id', $created['id']);

        $this->putJson("/api/v1/admin/attributes/{$created['id']}", [
            'name' => 'Motor',
            'slug' => 'motor',
            'data_type' => 'text',
            'unit' => 'HP',
            'is_filterable' => false,
            'is_active' => false,
            'sort_order' => 3,
        ])->assertOk()->assertJsonPath('data.is_active', false);

        $this->assertDatabaseHas('attributes', [
            'id' => $created['id'],
            'is_active' => false,
            'is_filterable' => false,
            'sort_order' => 3,
        ]);
        $this->postJson('/api/v1/admin/attributes', [
            'name' => 'Motor',
            'data_type' => 'text',
        ])->assertUnprocessable()->assertJsonStructure(['error' => ['details' => ['name']]]);
    }

    public function test_attribute_management_requires_catalog_permission(): void
    {
        $this->getJson('/api/v1/admin/attributes')->assertUnauthorized();
        $this->actingAs(User::factory()->create())
            ->postJson('/api/v1/admin/attributes', ['name' => 'Motor', 'data_type' => 'text'])
            ->assertForbidden();
    }
}
