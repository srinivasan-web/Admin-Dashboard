<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\CategoryFaq;
use App\Models\Permission;
use App\Models\Role;
use App\Models\ShopBenefit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductPageContentTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_faqs_are_category_scoped_active_and_ordered(): void
    {
        $treadmills = Category::factory()->create();
        $bikes = Category::factory()->create();
        CategoryFaq::query()->create(['category_id' => $treadmills->id, 'question' => 'Draft question?', 'answer' => 'Not published', 'is_active' => false]);
        CategoryFaq::query()->create(['category_id' => $bikes->id, 'question' => 'Bike question?', 'answer' => 'Bike answer', 'is_active' => true]);
        $later = CategoryFaq::query()->create(['category_id' => $treadmills->id, 'question' => 'Treadmill question?', 'answer' => 'Treadmill answer', 'sort_order' => 2, 'is_active' => true]);
        $first = CategoryFaq::query()->create(['question' => 'Global question?', 'answer' => 'Global answer', 'sort_order' => 1, 'is_active' => true]);

        $this->getJson('/api/v1/category-faqs?category_id='.$treadmills->id)
            ->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $first->id)
            ->assertJsonPath('data.1.id', $later->id);
        $this->getJson('/api/v1/category-faqs?category_id=invalid')->assertUnprocessable();

        $treadmills->update(['is_active' => false]);
        $this->getJson('/api/v1/category-faqs?category_id='.$treadmills->id)
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $first->id);
    }

    public function test_public_shop_benefits_only_return_active_approved_rows(): void
    {
        ShopBenefit::query()->create(['title' => 'Draft promise', 'is_active' => false]);
        $later = ShopBenefit::query()->create(['title' => 'Verified service B', 'description' => 'Stored terms', 'sort_order' => 2, 'is_active' => true]);
        $first = ShopBenefit::query()->create(['title' => 'Verified service A', 'sort_order' => 1, 'is_active' => true]);

        $this->getJson('/api/v1/shop-benefits')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $first->id)
            ->assertJsonPath('data.1.id', $later->id)
            ->assertJsonPath('data.1.description', 'Stored terms');
    }

    public function test_admin_can_manage_faqs_and_public_response_updates(): void
    {
        $category = Category::factory()->create();
        $this->actingAs($this->manager());

        $created = $this->postJson('/api/v1/admin/category-faqs', [
            'category_id' => $category->id,
            'question' => 'How is this maintained?',
            'answer' => 'Follow the stored product manual.',
            'is_active' => false,
        ])->assertCreated();
        $id = $created->json('data.id');
        $this->getJson('/api/v1/admin/category-faqs?category_id='.$category->id)
            ->assertOk()->assertJsonPath('data.0.id', $id);
        $this->getJson('/api/v1/category-faqs?category_id='.$category->id)->assertJsonCount(0, 'data');

        $this->putJson('/api/v1/admin/category-faqs/'.$id, ['answer' => 'Use the approved service manual.', 'is_active' => true])
            ->assertOk()->assertJsonPath('data.is_active', true);
        $this->getJson('/api/v1/category-faqs?category_id='.$category->id)
            ->assertJsonPath('data.0.answer', 'Use the approved service manual.');
        $this->deleteJson('/api/v1/admin/category-faqs/'.$id)->assertOk();
        $this->getJson('/api/v1/category-faqs?category_id='.$category->id)->assertJsonCount(0, 'data');
    }

    public function test_faq_writes_require_auth_permission_and_valid_fields(): void
    {
        $this->postJson('/api/v1/admin/category-faqs', ['question' => 'Question?', 'answer' => 'Answer'])->assertUnauthorized();
        $this->actingAs(User::factory()->create());
        $this->getJson('/api/v1/admin/category-faqs')->assertForbidden();
        $this->postJson('/api/v1/admin/category-faqs', ['question' => 'Question?', 'answer' => 'Answer'])->assertForbidden();

        $this->actingAs($this->manager());
        $this->postJson('/api/v1/admin/category-faqs', ['category_id' => 'invalid', 'question' => 'No', 'answer' => ''])
            ->assertUnprocessable()->assertJsonValidationErrors(['category_id', 'question', 'answer'], 'error.details');
        $this->assertDatabaseCount('category_faqs', 0);
    }

    public function test_admin_can_manage_shop_benefits_and_public_response_updates(): void
    {
        $this->actingAs($this->manager());

        $created = $this->postJson('/api/v1/admin/shop-benefits', [
            'title' => 'Verified store support',
            'description' => 'Available to customers after purchase.',
            'is_active' => false,
        ])->assertCreated();
        $id = $created->json('data.id');
        $this->getJson('/api/v1/admin/shop-benefits')->assertOk()->assertJsonPath('data.0.id', $id);
        $this->getJson('/api/v1/shop-benefits')->assertJsonCount(0, 'data');

        $this->putJson('/api/v1/admin/shop-benefits/'.$id, ['is_active' => true])
            ->assertOk()->assertJsonPath('data.is_active', true);
        $this->getJson('/api/v1/shop-benefits')->assertJsonPath('data.0.title', 'Verified store support');
        $this->deleteJson('/api/v1/admin/shop-benefits/'.$id)->assertOk();
        $this->getJson('/api/v1/shop-benefits')->assertJsonCount(0, 'data');
    }

    public function test_shop_benefit_writes_require_auth_permission_and_valid_fields(): void
    {
        $this->postJson('/api/v1/admin/shop-benefits', ['title' => 'Support'])->assertUnauthorized();
        $this->actingAs(User::factory()->create());
        $this->getJson('/api/v1/admin/shop-benefits')->assertForbidden();
        $this->postJson('/api/v1/admin/shop-benefits', ['title' => 'Support'])->assertForbidden();

        $this->actingAs($this->manager());
        $this->postJson('/api/v1/admin/shop-benefits', [
            'title' => 'X',
            'icon_media_id' => 'invalid',
            'sort_order' => -1,
        ])->assertUnprocessable()->assertJsonValidationErrors(['title', 'icon_media_id', 'sort_order'], 'error.details');
        $this->assertDatabaseCount('shop_benefits', 0);
    }

    private function manager(): User
    {
        $user = User::factory()->create();
        $role = Role::factory()->create();
        $role->permissions()->attach(Permission::factory()->create(['name' => 'catalog.manage']));
        $user->roles()->attach($role);

        return $user;
    }
}
