<?php

namespace Tests\Feature;

use App\Models\Customer;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class CustomerTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_identity_creation_and_updates(): void
    {
        $customer = Customer::factory()->create(['email' => 'customer@example.com', 'phone' => '9876543210']);
        $this->assertTrue(Str::isUuid($customer->id));
        $customer->update(['name' => 'Updated Customer']);
        $this->assertDatabaseHas('customers', ['id' => $customer->id, 'name' => 'Updated Customer']);
    }

    public function test_customer_email_and_phone_are_unique(): void
    {
        Customer::factory()->create(['email' => 'customer@example.com', 'phone' => '9876543210']);
        $this->expectException(QueryException::class);
        Customer::factory()->create(['email' => 'customer@example.com', 'phone' => '9999999999']);
    }

    public function test_customer_phone_is_unique(): void
    {
        Customer::factory()->create(['email' => 'first@example.com', 'phone' => '9876543210']);
        $this->expectException(QueryException::class);
        Customer::factory()->create(['email' => 'second@example.com', 'phone' => '9876543210']);
    }

    public function test_customer_archives_with_soft_delete(): void
    {
        $customer = Customer::factory()->create();
        $customer->delete();
        $this->assertSoftDeleted('customers', ['id' => $customer->id]);
        $this->assertTrue(Schema::hasColumns('customers', ['id', 'name', 'email', 'phone', 'deleted_at']));
    }
}
