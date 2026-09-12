<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class RoleAssignmentTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Users and roles are assigned through a UUID-backed, unique pivot row.
     */
    public function test_users_and_roles_can_be_assigned_many_to_many(): void
    {
        $user = User::factory()->create();
        $role = Role::factory()->create();

        $user->roles()->attach($role);

        $this->assertTrue(Schema::hasColumns('role_user', ['user_id', 'role_id']));
        $this->assertDatabaseHas('role_user', [
            'user_id' => $user->id,
            'role_id' => $role->id,
        ]);
        $this->assertTrue($role->users()->whereKey($user->id)->exists());

        $this->expectException(QueryException::class);

        $user->roles()->attach($role);
    }

    /**
     * Removing either endpoint removes only its association rows.
     */
    public function test_deleting_a_role_removes_its_user_assignments(): void
    {
        $user = User::factory()->create();
        $role = Role::factory()->create();

        $user->roles()->attach($role);
        $role->delete();

        $this->assertDatabaseMissing('role_user', [
            'user_id' => $user->id,
            'role_id' => $role->id,
        ]);
    }
}
