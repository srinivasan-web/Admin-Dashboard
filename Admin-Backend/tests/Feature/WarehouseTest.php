<?php

namespace Tests\Feature;

use App\Models\Warehouse;
use Database\Seeders\WarehouseSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class WarehouseTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Warehouses store only the PDF-supported location label and support fields.
     */
    public function test_warehouses_table_has_the_approved_columns(): void
    {
        $this->assertTrue(Schema::hasTable('warehouses'));
        $this->assertTrue(Schema::hasColumns('warehouses', [
            'id', 'name', 'created_at', 'updated_at',
        ]));
        $this->assertFalse(Schema::hasColumn('warehouses', 'code'));
        $this->assertFalse(Schema::hasColumn('warehouses', 'address'));
        $this->assertFalse(Schema::hasColumn('warehouses', 'city'));
        $this->assertFalse(Schema::hasColumn('warehouses', 'state'));
        $this->assertFalse(Schema::hasColumn('warehouses', 'postal_code'));
        $this->assertFalse(Schema::hasColumn('warehouses', 'is_active'));
        $this->assertFalse(Schema::hasColumn('warehouses', 'deleted_at'));
    }

    /**
     * Warehouse names are UUID-backed and unique.
     */
    public function test_warehouse_name_is_unique(): void
    {
        $warehouse = Warehouse::factory()->create(['name' => 'Por']);

        $this->assertTrue(Str::isUuid($warehouse->id));

        $this->expectException(QueryException::class);

        Warehouse::factory()->create(['name' => 'Por']);
    }

    /**
     * The source-backed warehouse seed is repeatable.
     */
    public function test_warehouse_seeder_creates_the_pdf_visible_locations(): void
    {
        $this->seed(WarehouseSeeder::class);
        $this->seed(WarehouseSeeder::class);

        $this->assertDatabaseHas('warehouses', ['name' => 'Por']);
        $this->assertDatabaseHas('warehouses', ['name' => 'Trichy']);
        $this->assertDatabaseCount('warehouses', 2);
    }

    /**
     * Without approved inventory dependents or retention rules, a warehouse deletes normally.
     */
    public function test_warehouse_can_be_deleted_without_soft_deletes(): void
    {
        $warehouse = Warehouse::factory()->create();

        $warehouse->delete();

        $this->assertDatabaseMissing('warehouses', ['id' => $warehouse->id]);
    }
}
