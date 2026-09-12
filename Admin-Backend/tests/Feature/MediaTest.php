<?php

namespace Tests\Feature;

use App\Models\Media;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class MediaTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Media records hold storage metadata only.
     */
    public function test_media_table_has_only_the_approved_metadata_columns(): void
    {
        $this->assertTrue(Schema::hasTable('media'));
        $this->assertTrue(Schema::hasColumns('media', [
            'id', 'disk', 'path', 'original_filename', 'mime_type', 'size_bytes',
            'created_at', 'updated_at',
        ]));
        $this->assertFalse(Schema::hasColumn('media', 'mediable_id'));
        $this->assertFalse(Schema::hasColumn('media', 'mediable_type'));
        $this->assertFalse(Schema::hasColumn('media', 'binary'));
        $this->assertFalse(Schema::hasColumn('media', 'deleted_at'));
    }

    /**
     * A storage location is unique within its disk.
     */
    public function test_media_uses_uuid_identity_and_unique_disk_path_pair(): void
    {
        $media = Media::factory()->create([
            'disk' => 'public',
            'path' => 'products/treadmill.jpg',
        ]);

        $this->assertTrue(Str::isUuid($media->id));
        $this->assertDatabaseHas('media', [
            'id' => $media->id,
            'path' => 'products/treadmill.jpg',
        ]);

        $this->expectException(QueryException::class);

        Media::factory()->create([
            'disk' => 'public',
            'path' => 'products/treadmill.jpg',
        ]);
    }

    /**
     * The same path may exist on distinct storage disks.
     */
    public function test_media_path_is_scoped_to_its_disk(): void
    {
        Media::factory()->create([
            'disk' => 'public',
            'path' => 'products/treadmill.jpg',
        ]);

        Media::factory()->create([
            'disk' => 's3',
            'path' => 'products/treadmill.jpg',
        ]);

        $this->assertDatabaseCount('media', 2);
    }
}
