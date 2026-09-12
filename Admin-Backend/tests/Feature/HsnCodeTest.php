<?php

namespace Tests\Feature;

use App\Models\HsnCode;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class HsnCodeTest extends TestCase
{
    use RefreshDatabase;

    /**
     * HSN codes retain only fields presented by the PDF form.
     */
    public function test_hsn_codes_table_has_the_approved_columns(): void
    {
        $this->assertTrue(Schema::hasTable('hsn_codes'));
        $this->assertTrue(Schema::hasColumns('hsn_codes', [
            'id',
            'title',
            'type',
            'hsn_code',
            'sgst_tax_multiplier',
            'igst_tax_multiplier',
            'created_at',
            'updated_at',
        ]));
        $this->assertFalse(Schema::hasColumn('hsn_codes', 'is_active'));
        $this->assertFalse(Schema::hasColumn('hsn_codes', 'deleted_at'));
        $this->assertFalse(Schema::hasColumn('hsn_codes', 'product_id'));
    }

    /**
     * HSN codes use UUIDs and preserve configured decimal precision.
     */
    public function test_hsn_code_persists_optional_fields_and_tax_multipliers(): void
    {
        $hsnCode = HsnCode::factory()->create([
            'title' => 'Exercise equipment',
            'type' => null,
            'hsn_code' => '95069100',
            'sgst_tax_multiplier' => '9.00',
            'igst_tax_multiplier' => '18.00',
        ]);

        $this->assertTrue(Str::isUuid($hsnCode->id));
        $this->assertSame('9.00', $hsnCode->sgst_tax_multiplier);
        $this->assertSame('18.00', $hsnCode->igst_tax_multiplier);
        $this->assertDatabaseHas('hsn_codes', [
            'id' => $hsnCode->id,
            'hsn_code' => '95069100',
        ]);
    }

    /**
     * A non-null HSN code cannot identify more than one master record.
     */
    public function test_hsn_codes_are_unique_when_present(): void
    {
        HsnCode::factory()->create(['hsn_code' => '95069100']);

        $this->expectException(QueryException::class);

        HsnCode::factory()->create(['hsn_code' => '95069100']);
    }

    /**
     * The current standalone master has no retention or dependent-delete policy.
     */
    public function test_hsn_code_can_be_deleted_without_soft_deletes(): void
    {
        $hsnCode = HsnCode::factory()->create();

        $hsnCode->delete();

        $this->assertDatabaseMissing('hsn_codes', ['id' => $hsnCode->id]);
    }
}
