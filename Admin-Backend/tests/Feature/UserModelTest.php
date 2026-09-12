<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class UserModelTest extends TestCase
{
    use RefreshDatabase;

    /**
     * The baseline user table remains compatible with Laravel authentication.
     */
    public function test_users_table_has_the_identity_columns_required_by_the_model(): void
    {
        $this->assertTrue(Schema::hasTable('users'));
        $this->assertTrue(Schema::hasColumns('users', [
            'id',
            'name',
            'email',
            'email_verified_at',
            'password',
            'remember_token',
            'created_at',
            'updated_at',
        ]));
    }

    /**
     * The factory and unique email constraint preserve the default auth contract.
     */
    public function test_users_can_be_created_with_a_unique_email_address(): void
    {
        $user = User::factory()->create();

        $this->assertTrue(Str::isUuid($user->id));

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'email' => $user->email,
        ]);

        $this->expectException(QueryException::class);

        User::factory()->create([
            'email' => $user->email,
        ]);
    }

    /**
     * Deleting a user retains the session record but clears its optional user reference.
     */
    public function test_deleting_a_user_sets_the_related_session_user_id_to_null(): void
    {
        $user = User::factory()->create();

        DB::table('sessions')->insert([
            'id' => 'session-id',
            'user_id' => $user->id,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit',
            'payload' => 'payload',
            'last_activity' => now()->timestamp,
        ]);

        $user->delete();

        $this->assertDatabaseHas('sessions', [
            'id' => 'session-id',
            'user_id' => null,
        ]);
    }
}
