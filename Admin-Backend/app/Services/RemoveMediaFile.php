<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

class RemoveMediaFile
{
    // Cleanup failure must never turn a committed media replacement into an
    // apparent failed save (which could make a client replay an upload).
    public function execute(string $disk, string $path): void
    {
        try {
            if (Storage::disk($disk)->delete($path)) {
                return;
            }
        } catch (Throwable $exception) {
            Log::warning('media.cleanup_failed', ['disk' => $disk, 'path' => $path, 'exception' => $exception::class]);

            return;
        }
        Log::warning('media.cleanup_failed', ['disk' => $disk, 'path' => $path]);
    }
}
