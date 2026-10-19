<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InitialAdminRegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_registers_the_first_catalog_manager(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->postJson('/api/v1/admin/auth/register', [
            'name' => 'Initial Manager',
            'email' => 'manager@example.test',
            'password' => 'correct-horse-battery-staple-1',
            'password_confirmation' => 'correct-horse-battery-staple-1',
        ])->assertCreated()
            ->assertJsonPath('data.user.email', 'manager@example.test')
            ->assertJsonPath('data.user.permissions', ['catalog.manage', 'inventory.manage']);

        $user = User::query()->where('email', 'manager@example.test')->sole();

        $this->assertTrue($user->hasPermission('catalog.manage'));
        $this->assertTrue($user->hasPermission('inventory.manage'));
        $this->assertFalse($user->hasPermission('orders.view'));
        $this->assertFalse($user->hasPermission('orders.manage'));

        $this->postJson('/api/v1/admin/auth/logout')->assertNoContent();
        $this->postJson('/api/v1/admin/auth/login', [
            'email' => 'manager@example.test',
            'password' => 'correct-horse-battery-staple-1',
        ])->assertOk()->assertJsonPath('data.user.id', $user->id);
    }

    public function test_it_rejects_registration_when_a_user_already_exists(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        User::factory()->create();

        $this->postJson('/api/v1/admin/auth/register', [
            'name' => 'Second Manager',
            'email' => 'second@example.test',
            'password' => 'correct-horse-battery-staple-1',
            'password_confirmation' => 'correct-horse-battery-staple-1',
        ])->assertConflict();
    }

    public function test_initial_registration_rejects_password_without_letters_or_numbers(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        foreach (['abc123', '123456789012', 'abcdefghijkl'] as $password) {
            $this->postJson('/api/v1/admin/auth/register', [
                'name' => 'Initial Manager',
                'email' => 'manager@example.test',
                'password' => $password,
                'password_confirmation' => $password,
            ])->assertUnprocessable()->assertJsonStructure(['error' => ['details' => ['password']]]);
        }

        $this->assertDatabaseCount('users', 0);
    }
}
