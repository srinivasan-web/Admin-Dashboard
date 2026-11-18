<?php

namespace Tests\Feature;

use App\Models\Banner;
use App\Models\Category;
use App\Models\ProductType;
use App\Models\Media;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class BannerApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_listing_banners_are_isolated_by_category_and_schedule(): void
    {
        $first = Category::factory()->create();
        $second = Category::factory()->create();
        $type = ProductType::factory()->create();
        $desktop = Media::factory()->create();
        $mobile = Media::factory()->create();
        $this->actingAs($this->manager());

        $base = array_merge($this->payload($desktop, $mobile), ['page' => 'listing']);
        $this->postJson('/api/v1/admin/banners', array_merge($base, ['category_id' => $first->id, 'title' => 'First category']))->assertCreated();
        $this->postJson('/api/v1/admin/banners', array_merge($base, ['category_id' => $second->id, 'title' => 'Second category']))->assertCreated();
        $this->postJson('/api/v1/admin/banners', array_merge($base, ['product_type_id' => $type->id, 'title' => 'Treadmills']))->assertCreated();
        $this->postJson('/api/v1/admin/banners', array_merge($base, ['category_id' => $first->id, 'title' => 'Upcoming', 'start_at' => now()->addDay()->toISOString()]))->assertCreated();
        $this->postJson('/api/v1/admin/banners', array_merge($base, ['page' => 'landing', 'category_id' => $first->id]))->assertUnprocessable();

        $this->getJson('/api/v1/banners/active?page=listing&category_id='.$first->id)
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', 'First category');
        $this->getJson('/api/v1/banners/active?page=listing&category_id='.$second->id)
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', 'Second category');
        $this->getJson('/api/v1/banners/active?page=listing&product_type_id='.$type->id)
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', 'Treadmills');
        $this->getJson('/api/v1/banners/active?page=listing')->assertExactJson(['data' => []]);
        $this->getJson('/api/v1/banners/active?page=landing&category_id='.$first->id)->assertNotFound();
    }

    public function test_schema_uses_uuid_media_foreign_keys_and_media_cannot_be_deleted_while_referenced(): void
    {
        $this->assertTrue(Schema::hasColumns('banners', [
            'id', 'title', 'description', 'cta_text', 'desktop_media_id', 'mobile_media_id', 'page', 'sort_order',
            'redirect_url', 'start_at', 'end_at', 'is_active', 'created_at', 'updated_at',
        ]));

        $desktop = Media::factory()->create();
        $mobile = Media::factory()->create();
        $banner = Banner::query()->create($this->payload($desktop, $mobile));

        $this->assertTrue(Str::isUuid($banner->id));
        $this->assertSame($desktop->id, $banner->desktopMedia->id);
        $this->assertSame($mobile->id, $banner->mobileMedia->id);

        $this->expectException(QueryException::class);
        $desktop->delete();
    }

    public function test_authorized_manager_can_create_read_update_deactivate_and_delete_banner_without_deleting_media(): void
    {
        $desktop = Media::factory()->create();
        $mobile = Media::factory()->create();
        $this->actingAs($this->manager());

        $response = $this->postJson('/api/v1/admin/banners', array_merge($this->payload($desktop, $mobile), [
            'description' => 'Build your home routine.', 'cta_text' => 'Explore treadmills',
        ]))
            ->assertCreated()
            ->assertJsonPath('data.title', 'Autumn campaign')
            ->assertJsonPath('data.description', 'Build your home routine.')
            ->assertJsonPath('data.cta_text', 'Explore treadmills')
            ->assertJsonPath('data.desktop_media.id', $desktop->id)
            ->assertJsonPath('data.mobile_media.id', $mobile->id);
        $id = $response->json('data.id');

        $this->getJson("/api/v1/admin/banners/{$id}")
            ->assertOk()->assertJsonPath('data.desktop_media_id', $desktop->id);
        $this->putJson("/api/v1/admin/banners/{$id}", [
            'title' => 'Winter campaign', 'is_active' => false, 'sort_order' => 5,
        ])->assertOk()->assertJsonPath('data.is_active', false);
        $this->assertDatabaseHas('banners', ['id' => $id, 'title' => 'Winter campaign', 'sort_order' => 5, 'is_active' => false]);

        $this->deleteJson("/api/v1/admin/banners/{$id}")->assertOk();
        $this->assertDatabaseMissing('banners', ['id' => $id]);
        $this->assertDatabaseHas('media', ['id' => $desktop->id]);
        $this->assertDatabaseHas('media', ['id' => $mobile->id]);
    }

    public function test_index_search_status_schedule_sort_and_pagination(): void
    {
        $desktop = Media::factory()->create();
        $mobile = Media::factory()->create();
        $this->actingAs($this->manager());

        Banner::query()->create(array_merge($this->payload($desktop, $mobile), [
            'title' => 'Current sale', 'sort_order' => 2,
            'start_at' => now()->subDay(), 'end_at' => now()->addDay(),
        ]));
        Banner::query()->create(array_merge($this->payload($desktop, $mobile), [
            'title' => 'Future sale', 'sort_order' => 8,
            'start_at' => now()->addDay(), 'end_at' => now()->addWeek(),
        ]));
        Banner::query()->create(array_merge($this->payload($desktop, $mobile), [
            'title' => 'Past sale', 'sort_order' => 1, 'is_active' => false,
            'start_at' => now()->subWeek(), 'end_at' => now()->subDay(),
        ]));

        $this->getJson('/api/v1/admin/banners?search=Current&status=active&scheduling=current')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', 'Current sale');
        $this->getJson('/api/v1/admin/banners?scheduling=upcoming')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', 'Future sale');
        $this->getJson('/api/v1/admin/banners?scheduling=expired&status=inactive')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', 'Past sale');
        $this->getJson('/api/v1/admin/banners?sort_order=desc&per_page=1&page=2')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', 'Current sale')
            ->assertJsonPath('meta.total', 3);
    }

    public function test_invalid_media_and_dates_are_rejected_on_create_and_partial_update(): void
    {
        $desktop = Media::factory()->create();
        $mobile = Media::factory()->create();
        $document = Media::factory()->create(['mime_type' => 'application/pdf']);
        $this->actingAs($this->manager());

        $this->postJson('/api/v1/admin/banners', $this->payload($document, $mobile))
            ->assertUnprocessable()->assertJsonValidationErrors('desktop_media_id', 'error.details');
        $this->postJson('/api/v1/admin/banners', array_merge($this->payload($desktop, $mobile), [
            'redirect_url' => 'javascript:alert(1)',
        ]))->assertUnprocessable()->assertJsonValidationErrors('redirect_url', 'error.details');
        $this->postJson('/api/v1/admin/banners', array_merge($this->payload($desktop, $mobile), [
            'start_at' => now()->addDay()->toDateTimeString(),
            'end_at' => now()->toDateTimeString(),
        ]))->assertUnprocessable()->assertJsonValidationErrors('end_at', 'error.details');
        $this->assertDatabaseCount('banners', 0);

        $banner = Banner::query()->create(array_merge($this->payload($desktop, $mobile), [
            'start_at' => now()->toDateTimeString(),
        ]));
        $this->putJson("/api/v1/admin/banners/{$banner->id}", [
            'end_at' => now()->subDay()->toDateTimeString(),
        ])->assertUnprocessable()->assertJsonValidationErrors('end_at', 'error.details');
        $this->assertNull($banner->fresh()->end_at);
    }

    public function test_banners_require_authentication_and_existing_catalog_permission(): void
    {
        $desktop = Media::factory()->create();
        $mobile = Media::factory()->create();
        $payload = $this->payload($desktop, $mobile);
        $banner = Banner::query()->create($payload);

        $this->getJson('/api/v1/admin/banners')->assertUnauthorized();
        $this->postJson('/api/v1/admin/banners', $payload)->assertUnauthorized();
        $this->getJson("/api/v1/admin/banners/{$banner->id}")->assertUnauthorized();

        $this->actingAs(User::factory()->create());
        $this->getJson('/api/v1/admin/banners')->assertForbidden();
        $this->postJson('/api/v1/admin/banners', $payload)->assertForbidden();
        $this->getJson("/api/v1/admin/banners/{$banner->id}")->assertForbidden();
        $this->putJson("/api/v1/admin/banners/{$banner->id}", ['title' => 'Unauthorized update'])->assertForbidden();
        $this->deleteJson("/api/v1/admin/banners/{$banner->id}")->assertForbidden();
        $this->assertDatabaseHas('banners', ['id' => $banner->id, 'title' => 'Autumn campaign']);
    }

    public function test_admin_can_upload_and_select_a_real_media_record_for_banner_creation(): void
    {
        Storage::fake('public');
        $this->actingAs($this->manager());

        $upload = $this->postJson('/api/v1/admin/media', [
            'image' => UploadedFile::fake()->image('desktop.jpg'),
        ])->assertCreated()->assertJsonPath('data.mime_type', 'image/jpeg');
        $desktopId = $upload->json('data.id');
        $desktop = Media::query()->findOrFail($desktopId);
        Storage::disk('public')->assertExists($desktop->path);
        $mobile = Media::factory()->create();

        $this->getJson('/api/v1/admin/media?search=desktop')
            ->assertOk()->assertJsonPath('data.0.id', $desktopId);
        $this->postJson('/api/v1/admin/banners', $this->payload($desktop, $mobile))
            ->assertCreated()->assertJsonPath('data.desktop_media.id', $desktopId);
    }

    public function test_media_upload_rejects_invalid_files_and_requires_catalog_permission(): void
    {
        Storage::fake('public');
        $this->postJson('/api/v1/admin/media', [
            'image' => UploadedFile::fake()->image('guest.jpg'),
        ])->assertUnauthorized();

        $this->actingAs(User::factory()->create());
        $this->getJson('/api/v1/admin/media')->assertForbidden();
        $this->postJson('/api/v1/admin/media', [
            'image' => UploadedFile::fake()->image('forbidden.jpg'),
        ])->assertForbidden();

        $this->actingAs($this->manager());
        $this->postJson('/api/v1/admin/media', [
            'image' => UploadedFile::fake()->create('document.pdf', 10, 'application/pdf'),
        ])->assertUnprocessable()->assertJsonValidationErrors('image', 'error.details');
        $this->assertDatabaseCount('media', 0);
    }

    public function test_public_carousel_returns_only_current_active_home_banners_in_order_and_reflects_admin_changes(): void
    {
        $desktop = Media::factory()->create();
        $mobile = Media::factory()->create();
        $base = $this->payload($desktop, $mobile);
        $first = Banner::query()->create(array_merge($base, [
            'title' => 'First banner', 'description' => 'Move at home',
            'cta_text' => 'Explore', 'sort_order' => 1, 'page' => 'landing',
            'start_at' => now()->subDay(), 'end_at' => now()->addDay(),
        ]));
        $second = Banner::query()->create(array_merge($base, [
            'title' => 'Legacy homepage banner', 'sort_order' => 2, 'page' => 'home',
        ]));
        $listing = Banner::query()->create(array_merge($base, ['title' => 'Listing only', 'page' => 'listing']));
        Banner::query()->create(array_merge($base, ['title' => 'Inactive', 'is_active' => false]));
        Banner::query()->create(array_merge($base, ['title' => 'Upcoming', 'start_at' => now()->addDay()]));
        Banner::query()->create(array_merge($base, ['title' => 'Expired', 'end_at' => now()->subDay()]));

        $this->getJson('/api/v1/banners/active')
            ->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $first->id)
            ->assertJsonPath('data.0.description', 'Move at home')
            ->assertJsonPath('data.0.cta_text', 'Explore')
            ->assertJsonPath('data.0.cta_url', 'https://www.durafit91.com/products')
            ->assertJsonPath('data.0.display_order', 1)
            ->assertJsonPath('data.0.status', 'active')
            ->assertJsonPath('data.1.id', $second->id);
        $this->getJson('/api/v1/banners/active?page=listing')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $listing->id);
        $this->getJson('/api/v1/banners/active?page=unsupported')->assertUnprocessable();

        $this->actingAs($this->manager());
        $this->putJson("/api/v1/admin/banners/{$second->id}", [
            'sort_order' => 0, 'title' => 'Reordered banner',
        ])->assertOk();
        $this->getJson('/api/v1/banners/active')
            ->assertJsonPath('data.0.id', $second->id)
            ->assertJsonPath('data.0.title', 'Reordered banner');
        $this->putJson("/api/v1/admin/banners/{$second->id}", ['is_active' => false])->assertOk();
        $this->getJson('/api/v1/banners/active')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $first->id);
    }

    /** @return array<string, mixed> */
    private function payload(Media $desktop, Media $mobile): array
    {
        return [
            'title' => 'Autumn campaign',
            'desktop_media_id' => $desktop->id,
            'mobile_media_id' => $mobile->id,
            'page' => 'home',
            'sort_order' => 0,
            'redirect_url' => 'https://www.durafit91.com/products',
            'is_active' => true,
        ];
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
