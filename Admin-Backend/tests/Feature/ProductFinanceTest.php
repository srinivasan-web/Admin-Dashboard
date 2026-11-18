<?php

namespace Tests\Feature;

use App\Models\EmiCalculation;
use App\Models\EmiPlan;
use App\Models\EmiProvider;
use App\Models\FlashSale;
use App\Models\FlashSaleProduct;
use App\Models\Permission;
use App\Models\Product;
use App\Models\ProductEmiPlan;
use App\Models\ProductVariant;
use App\Models\Role;
use App\Models\User;
use App\Models\WarehouseStock;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ProductFinanceTest extends TestCase
{
    use RefreshDatabase;

    private function product(array $data = []): Product
    {
        $product = Product::factory()->create(array_merge(['mrp_price' => '40000.00', 'sale_price' => '30000.00', 'slug' => 'finance-test'], $data));
        WarehouseStock::factory()->create(['product_id' => $product->id, 'quantity' => 3]);

        return $product;
    }

    private function plan(Product $product, array $data = [], ?string $variant = null): EmiPlan
    {
        $provider = EmiProvider::query()->create(['name' => 'Synthetic Test Lender', 'code' => 'test-'.fake()->uuid(), 'is_active' => true]);
        $plan = EmiPlan::query()->create(array_merge(['provider_id' => $provider->id, 'tenure_months' => 6,
            'annual_interest_rate' => 0, 'processing_fee' => 100, 'minimum_amount' => 100,
            'is_no_cost' => false, 'is_active' => true], $data));
        ProductEmiPlan::query()->create(['product_id' => $product->id, 'variant_id' => $variant, 'emi_plan_id' => $plan->id, 'is_active' => true]);

        return $plan;
    }

    private function flash(Product $product, array $saleData = [], array $priceData = []): FlashSale
    {
        $sale = FlashSale::query()->create(array_merge(['name' => 'Synthetic Sale', 'starts_at' => now()->subHour(), 'ends_at' => now()->addHour(), 'is_active' => true], $saleData));
        FlashSaleProduct::query()->create(array_merge(['flash_sale_id' => $sale->id, 'product_id' => $product->id,
            'discount_type' => 'price', 'discount_value' => '27000.00', 'is_active' => true], $priceData));

        return $sale;
    }

    public function test_zero_interest_and_no_cost_use_persisted_price_without_saving_calculations(): void
    {
        $product = $this->product();
        $plan = $this->plan($product);
        $this->getJson('/api/v1/products/'.$product->slug.'/purchase-options')->assertOk()
            ->assertJsonPath('data.price.selling_price', '30000.00')->assertJsonPath('data.price.checkout_available', false)
            ->assertJsonPath('data.plans.0.provider.name', 'Synthetic Test Lender');
        $this->postJson('/api/v1/products/'.$product->id.'/emi/calculate', ['plan_id' => $plan->id])->assertOk()
            ->assertJsonPath('data.monthly_emi', '5000.00')->assertJsonPath('data.interest_payable', '0.00')
            ->assertJsonPath('data.total_payable', '30100.00')->assertJsonPath('data.method', 'zero_interest');
        $plan->update(['annual_interest_rate' => 15, 'is_no_cost' => true]);
        $this->postJson('/api/v1/products/'.$product->id.'/emi/calculate', ['plan_id' => $plan->id])->assertOk()
            ->assertJsonPath('data.method', 'no_cost')->assertJsonPath('data.interest_payable', '0.00');
        $this->assertDatabaseCount('emi_calculations', 0);
        $this->postJson('/api/v1/products/'.$product->id.'/emi/calculate', ['plan_id' => $plan->id, 'principal' => 1, 'tenure_months' => 2])
            ->assertUnprocessable()->assertJsonValidationErrors(['principal', 'tenure_months'], 'error.details');
    }

    public function test_reducing_balance_and_final_instalment_rounding_and_changed_prices(): void
    {
        $product = $this->product(['sale_price' => '10000.00']);
        $plan = $this->plan($product, ['tenure_months' => 12, 'annual_interest_rate' => 12]);
        $url = '/api/v1/products/'.$product->id.'/emi/calculate';
        $response = $this->postJson($url, ['plan_id' => $plan->id])->assertOk()
            ->assertJsonPath('data.method', 'reducing_balance')->assertJsonPath('data.monthly_emi', '888.49')
            ->assertJsonPath('data.total_payable', '10761.85');
        $quote = $response->json('data');
        $this->assertEqualsWithDelta((float) $quote['total_payable'], 11 * (float) $quote['monthly_emi'] + (float) $quote['final_instalment'] + 100, 0.001);
        $product->update(['sale_price' => '20000.00']);
        $this->postJson($url, ['plan_id' => $plan->id])->assertOk()->assertJsonPath('data.principal', '20000.00');
    }

    public function test_ineligible_plans_and_foreign_variants_are_rejected(): void
    {
        $product = $this->product();
        $plan = $this->plan($product, ['ends_at' => now()]);
        $url = '/api/v1/products/'.$product->id;
        $this->getJson($url.'/purchase-options')->assertOk()->assertJsonCount(0, 'data.plans');
        $this->postJson($url.'/emi/calculate', ['plan_id' => $plan->id])->assertUnprocessable();
        $plan->update(['ends_at' => null, 'minimum_amount' => '30001.00']);
        $this->getJson($url.'/purchase-options')->assertJsonCount(0, 'data.plans');
        $plan->update(['minimum_amount' => 0, 'maximum_amount' => '29999.00']);
        $this->getJson($url.'/purchase-options')->assertJsonCount(0, 'data.plans');
        $plan->update(['maximum_amount' => null]);
        $plan->provider->update(['is_active' => false]);
        $this->getJson($url.'/purchase-options')->assertJsonCount(0, 'data.plans');
        $foreign = ProductVariant::factory()->create();
        $this->getJson($url.'/purchase-options?variant_id='.$foreign->id)->assertUnprocessable();
        $this->postJson($url.'/emi/calculate', ['plan_id' => fake()->uuid()])->assertUnprocessable();
    }

    public function test_variant_mappings_are_not_shown_for_other_variants_or_base_product(): void
    {
        $product = $this->product();
        $variant = ProductVariant::factory()->create(['product_id' => $product->id]);
        $this->plan($product, [], $variant->id);
        $url = '/api/v1/products/'.$product->id.'/purchase-options';
        $this->getJson($url)->assertJsonCount(0, 'data.plans');
        $this->getJson($url.'?variant_id='.$variant->id)->assertOk()->assertJsonCount(1, 'data.plans');
    }

    public function test_flash_sale_boundaries_and_lowest_valid_price_and_eligibility(): void
    {
        $this->travelTo(now()->startOfSecond());
        $product = $this->product();
        $sale = $this->flash($product, ['starts_at' => now(), 'ends_at' => now()->addMinute()]);
        $this->flash($product, [], ['discount_type' => 'percent', 'discount_value' => 5]);
        $this->flash($product, ['is_active' => false], ['discount_value' => 1]);
        $this->flash($product, ['starts_at' => now()->addDay(), 'ends_at' => now()->addDays(2)], ['discount_value' => 1]);
        $url = '/api/v1/products/'.$product->id.'/purchase-options';
        $this->getJson($url)->assertOk()->assertJsonPath('data.price.selling_price', '27000.00')->assertJsonPath('data.price.flash_sale.id', $sale->id);
        $this->travel(1)->minutes();
        $this->getJson($url)->assertOk()->assertJsonPath('data.price.selling_price', '28500.00');
        $product->update(['is_active' => false]);
        $this->getJson($url)->assertNotFound();
    }

    public function test_expired_flash_does_not_change_product_or_price_history_and_emi_uses_current_flash_price(): void
    {
        $product = $this->product();
        $plan = $this->plan($product);
        $sale = $this->flash($product);
        $url = '/api/v1/products/'.$product->id;
        $this->postJson($url.'/emi/calculate', ['plan_id' => $plan->id])->assertOk()->assertJsonPath('data.principal', '27000.00');
        $sale->update(['ends_at' => now()]);
        $this->getJson($url.'/purchase-options')->assertOk()->assertJsonPath('data.price.selling_price', '30000.00')->assertJsonPath('data.price.flash_sale', null);
        $this->assertSame('30000.00', $product->fresh()->sale_price);
        $this->assertDatabaseCount('product_prices', 0);
    }

    public function test_enquiry_requires_consent_and_stores_contact_encrypted_only_on_success(): void
    {
        $product = $this->product();
        $plan = $this->plan($product);
        $url = '/api/v1/products/'.$product->id.'/emi/enquiries';
        $this->postJson($url, ['plan_id' => $plan->id, 'mobile_number' => '9876543210'])->assertUnprocessable();
        $this->postJson($url, ['plan_id' => $plan->id, 'mobile_number' => '123', 'consent' => true])->assertUnprocessable();
        $this->assertDatabaseCount('emi_calculations', 0);
        $response = $this->postJson($url, ['plan_id' => $plan->id, 'mobile_number' => '9876543210', 'consent' => true])->assertCreated();
        $this->assertStringNotContainsString('9876543210', $response->getContent());
        $record = EmiCalculation::query()->firstOrFail();
        $this->assertSame('9876543210', $record->mobile_number);
        $this->assertNotSame('9876543210', DB::table('emi_calculations')->value('mobile_number'));
        $this->assertSame('30000.00', $record->quote['principal']);
    }

    public function test_configuration_requires_permission_validates_ownership_and_prevents_duplicates(): void
    {
        $product = $this->product();
        $plan = $this->plan($product);
        $url = '/api/v1/admin/finance/product-emi-plans';
        $this->postJson($url, [])->assertUnauthorized();
        $this->actingAs(User::factory()->create());
        $this->postJson($url, [])->assertForbidden();
        $user = User::factory()->create();
        $role = Role::factory()->create();
        $role->permissions()->attach(Permission::factory()->create(['name' => 'catalog.manage']));
        $user->roles()->attach($role);
        $this->actingAs($user);
        $this->postJson($url, ['product_id' => $product->id, 'emi_plan_id' => $plan->id, 'is_active' => true, 'sort_order' => 0])
            ->assertUnprocessable()->assertJsonValidationErrors('emi_plan_id', 'error.details');
        $variant = ProductVariant::factory()->create();
        $this->postJson($url, ['product_id' => $product->id, 'variant_id' => $variant->id, 'emi_plan_id' => $plan->id, 'is_active' => true, 'sort_order' => 0])
            ->assertUnprocessable()->assertJsonValidationErrors('variant_id', 'error.details');
        $this->postJson('/api/v1/admin/finance/emi-providers', ['name' => 'Approved Lender', 'code' => 'approved', 'is_active' => true])->assertCreated();
        $this->getJson('/api/v1/admin/finance/emi-providers')->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_database_uniqueness_also_prevents_duplicate_base_plan_assignments(): void
    {
        $product = $this->product();
        $plan = $this->plan($product);
        $this->expectException(QueryException::class);
        ProductEmiPlan::query()->create(['product_id' => $product->id, 'emi_plan_id' => $plan->id, 'is_active' => true]);
    }

    public function test_rounding_never_creates_a_negative_final_instalment(): void
    {
        $product = $this->product(['mrp_price' => '0.70', 'sale_price' => null]);
        $plan = $this->plan($product, ['minimum_amount' => 0, 'processing_fee' => 0, 'tenure_months' => 120]);
        $this->postJson('/api/v1/products/'.$product->id.'/emi/calculate', ['plan_id' => $plan->id])->assertOk()
            ->assertJsonPath('data.monthly_emi', '0.00')->assertJsonPath('data.final_instalment', '0.70');
    }

    public function test_rejected_enquiries_never_persist_partial_records_and_are_rate_limited(): void
    {
        $product = $this->product();
        $plan = $this->plan($product, ['is_active' => false]);
        $url = '/api/v1/products/'.$product->id.'/emi/enquiries';
        for ($i = 0; $i < 5; $i++) {
            $this->postJson($url, ['plan_id' => $plan->id, 'mobile_number' => '9876543210', 'consent' => true])->assertUnprocessable();
        }
        $this->postJson($url, ['plan_id' => $plan->id, 'mobile_number' => '9876543210', 'consent' => true])->assertStatus(429);
        $this->assertDatabaseCount('emi_calculations', 0);
    }
}
