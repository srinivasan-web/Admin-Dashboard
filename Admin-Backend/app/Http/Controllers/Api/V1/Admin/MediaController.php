<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMediaRequest;
use App\Http\Resources\MediaResource;
use App\Models\Media;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

class MediaController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()?->hasPermission('catalog.manage'), 403);
        $filters = $request->validate([
            'search' => ['sometimes', 'string', 'max:100'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        return MediaResource::collection(Media::query()
            ->where('mime_type', 'like', 'image/%')
            ->when($filters['search'] ?? null, fn ($query, string $search) =>
                $query->where('original_filename', 'like', '%'.$search.'%'))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(24));
    }

    public function store(StoreMediaRequest $request): JsonResponse
    {
        $image = $request->file('image');
        $path = $image->store('banners', 'public');
        if (!$path) {
            throw new RuntimeException('Unable to store the banner image.');
        }

        try {
            $media = Media::query()->create([
                'disk' => 'public',
                'path' => $path,
                'original_filename' => $image->getClientOriginalName(),
                'mime_type' => $image->getMimeType(),
                'size_bytes' => $image->getSize(),
            ]);
        } catch (Throwable $exception) {
            Storage::disk('public')->delete($path);
            throw $exception;
        }

        return (new MediaResource($media))->response()->setStatusCode(201);
    }
}
