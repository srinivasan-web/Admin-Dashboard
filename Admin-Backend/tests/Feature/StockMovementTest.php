<?php

namespace Tests\Feature;

use App\Models\StockMovement;
use App\Models\User;
use App\Models\WarehouseStock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use LogicException;
use Tests\TestCase;

class StockMovementTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Audit events retain only the approved stock reference, signed delta, type, and actor.
     */
    public function test_stock_movements_table_has_the_approved_columns(): void
    {
        $this->assertTrue(Schema::hasTable('stock_movements'));
        $this->assertTrue(Schema::hasColumns('stock_movements', [
            'id', 'warehouse_stock_id', 'movement_type', 'quantity_delta', 'created_by', 'created_at',
        ]));
        $this->assertFalse(Schema::hasColumn('stock_movements', 'updated_at'));
        $this->assertFalse(Schema::hasColumn('stock_movements', 'reference_type'));
        $this->assertFalse(Schema::hasColumn('stock_movements', 'reference_id'));
        $this->assertFalse(Schema::hasColumn('stock_movements', 'deleted_at'));
    }

    /**
     * Stock movements support positive and negative signed quantity deltas.
     */
    public function test_stock_movement_persists_signed_deltas_and_relationships(): void
    {
        $actor = User::factory()->create();
        $stock = WarehouseStock::factory()->create();
        $movement = StockMovement::factory()->create([
            'warehouse_stock_id' => $stock->id,
            'created_by' => $actor->id,
            'movement_type' => 'adjustment',
            'quantity_delta' => -3,
        ]);

        $this->assertTrue(Str::isUuid($movement->id));
        $this->assertSame(-3, $movement->quantity_delta);
        $this->assertSame($movement->id, $movement->warehouseStock->movements->sole()->id);
        $this->assertSame($movement->id, $movement->createdBy->stockMovements->sole()->id);
    }

    /**
     * A zero delta cannot represent an inventory event.
     */
    public function test_stock_movement_delta_cannot_be_zero(): void
    {
        $this->expectException(LogicException::class);

        StockMovement::factory()->create(['quantity_delta' => 0]);
    }

    /**
     * System-generated movements may omit an actor and preserve history if a user is removed.
     */
    public function test_stock_movement_actor_is_optional_and_nulls_on_user_delete(): void
    {
        $actor = User::factory()->create();
        $movement = StockMovement::factory()->create(['created_by' => $actor->id]);

        $actor->delete();

        $this->assertDatabaseHas('stock_movements', [
            'id' => $movement->id,
            'created_by' => null,
        ]);
    }

    /**
     * Eloquent updates and deletes of movement history are blocked.
     */
    public function test_stock_movements_are_immutable_at_the_application_layer(): void
    {
        $movement = StockMovement::factory()->create();

        try {
            $movement->update(['quantity_delta' => 2]);
            $this->fail('Expected a stock movement update to be blocked.');
        } catch (LogicException) {
            $this->expectException(LogicException::class);
            $movement->delete();
        }
    }
}
