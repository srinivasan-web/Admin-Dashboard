<?php

namespace Tests\Feature;

use App\Models\Permission;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class PermissionTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Permissions are standalone UUID-backed resource-action identifiers.
     */
    public function test_permissions_table_has_the_required_columns(): void
    {
        $this->assertTrue(Schema::hasTable('permissions'));
        $this->assertTrue(Schema::hasColumns('permissions', [
            'id',
            'name',
            'description',
            'created_at',
            'updated_at',
        ]));
        $this->assertFalse(Schema::hasColumn('permissions', 'deleted_at'));
    }

    /**
     * Permission names are unique and use the resource.action convention.
     */
    public function test_permissions_can_be_created_with_unique_resource_action_names(): void
    {
        $permission = Permission::factory()->create([
            'name' => 'product.view',
        ]);

        $this->assertTrue(Str::isUuid($permission->id));
        $this->assertDatabaseHas('permissions', [
            'id' => $permission->id,
            'name' => 'product.view',
        ]);

        $this->expectException(QueryException::class);

        Permission::factory()->create([
            'name' => 'product.view',
        ]);
    }
}
