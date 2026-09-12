<?php

namespace Tests\Feature;

use App\Models\Role;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class RoleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * The roles reference table has its required fields and does not imply user assignment.
     */
    public function test_roles_table_has_the_required_columns(): void
    {
        $this->assertTrue(Schema::hasTable('roles'));
        $this->assertTrue(Schema::hasColumns('roles', [
            'id',
            'name',
            'slug',
            'description',
            'created_at',
            'updated_at',
        ]));
        $this->assertFalse(Schema::hasColumn('roles', 'deleted_at'));
    }

    /**
     * Role names and slugs are stable unique identifiers.
     */
    public function test_roles_can_be_created_with_unique_names_and_slugs(): void
    {
        $role = Role::factory()->create([
            'name' => 'Content Manager',
            'slug' => 'content-manager',
        ]);

        $this->assertTrue(Str::isUuid($role->id));

        $this->assertDatabaseHas('roles', [
            'id' => $role->id,
            'slug' => 'content-manager',
        ]);

        $this->expectException(QueryException::class);

        Role::factory()->create([
            'name' => 'Content Manager',
            'slug' => 'other-role',
        ]);
    }

    /**
     * A slug cannot identify more than one role.
     */
    public function test_role_slugs_are_unique(): void
    {
        Role::factory()->create([
            'name' => 'Content Manager',
            'slug' => 'content-manager',
        ]);

        $this->expectException(QueryException::class);

        Role::factory()->create([
            'name' => 'Catalog Manager',
            'slug' => 'content-manager',
        ]);
    }
}
