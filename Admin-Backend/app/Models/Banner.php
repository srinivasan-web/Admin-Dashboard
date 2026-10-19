<?php

namespace App\Models;

use App\Services\PublicBannerCache;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

class Banner extends Model
{
    use HasUuids;

    protected static function booted(): void
    {
        $invalidate = fn () => DB::afterCommit(
            fn () => app(PublicBannerCache::class)->invalidate(),
        );
        static::saved($invalidate);
        static::deleted($invalidate);
    }

    /** @var list<string> */
    protected $fillable = [
        'title', 'description', 'cta_text', 'desktop_media_id', 'mobile_media_id', 'page', 'sort_order',
        'redirect_url', 'start_at', 'end_at', 'is_active',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_active' => 'boolean',
            'start_at' => 'datetime',
            'end_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Media, $this> */
    public function desktopMedia(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'desktop_media_id');
    }

    /** @return BelongsTo<Media, $this> */
    public function mobileMedia(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'mobile_media_id');
    }

    public function scopeVisibleOnHome(Builder $query): Builder
    {
        $now = now();

        return $query->whereIn('page', ['landing', 'home'])
            ->where('is_active', true)
            ->where(fn (Builder $query) => $query->whereNull('start_at')->orWhere('start_at', '<=', $now))
            ->where(fn (Builder $query) => $query->whereNull('end_at')->orWhere('end_at', '>=', $now));
    }
}
