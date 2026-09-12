<?php

namespace Tests\Feature;

use App\Models\Combo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class ComboTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Combos are limited to the PDF-supported merchandising header fields.
     */
    public function test_combos_table_has_the_approved_columns(): void
    {
        $this->assertTrue(Schema::hasTable('combos'));
        $this->assertTrue(Schema::hasColumns('combos', [
            'id', 'name', 'is_active', 'created_at', 'updated_at',
        ]));
        $this->assertFalse(Schema::hasColumn('combos', 'slug'));
        $this->assertFalse(Schema::hasColumn('combos', 'description'));
        $this->assertFalse(Schema::hasColumn('combos', 'deleted_at'));
        $this->assertFalse(Schema::hasColumn('combos', 'product_id'));
    }

    /**
     * A combo has UUID identity and starts active.
     */
    public function test_combo_defaults_to_active(): void
    {
        $combo = Combo::factory()->create(['name' => 'Treadmill Essentials']);

        $this->assertTrue(Str::isUuid($combo->id));
        $this->assertTrue($combo->is_active);
        $this->assertDatabaseHas('combos', [
            'id' => $combo->id,
            'name' => 'Treadmill Essentials',
            'is_active' => true,
        ]);
    }

    /**
     * With no approved dependents or retention requirement, a combo deletes normally.
     */
    public function test_combo_can_be_deleted_without_soft_deletes(): void
    {
        $combo = Combo::factory()->create();

        $combo->delete();

        $this->assertDatabaseMissing('combos', ['id' => $combo->id]);
    }
}
