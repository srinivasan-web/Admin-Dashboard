<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAuthSessionTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_sign_in_use_the_session_and_sign_out(): void
    {
        $user = User::factory()->create([
            'email' => 'sales.manager@example.test',
            'password' => 'correct-horse-battery-staple',
        ]);

        $this->postJson('/api/v1/admin/auth/login', [
            'email' => $user->email,
            'password' => 'correct-horse-battery-staple',
        ])->assertOk()->assertJsonPath('data.user.email', $user->email);

        $this->getJson('/api/v1/admin/auth/me')
            ->assertOk()->assertJsonPath('data.user.id', $user->id);

        $this->postJson('/api/v1/admin/auth/logout')->assertNoContent();
        $this->getJson('/api/v1/admin/auth/me')->assertUnauthorized();
    }

    public function test_invalid_password_does_not_start_a_session(): void
    {
        User::factory()->create(['email' => 'sales.manager@example.test']);

        $this->postJson('/api/v1/admin/auth/login', [
            'email' => 'sales.manager@example.test',
            'password' => 'incorrect-password',
        ])->assertUnprocessable()
            ->assertJsonPath('error.details.email.0', 'The provided credentials are incorrect.');

        $this->getJson('/api/v1/admin/auth/me')->assertUnauthorized();
    }
}
