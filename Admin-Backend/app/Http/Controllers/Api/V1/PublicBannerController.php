<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\PublicBannerCache;
use App\Models\Category;
use App\Models\ProductType;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PublicBannerController extends Controller
{
    public function active(Request $request, PublicBannerCache $cache): Response
    {
        $data = $request->validate(['page' => ['sometimes', 'in:landing,listing'], 'category_id' => ['sometimes', 'uuid'], 'product_type_id' => ['sometimes', 'uuid']]);
        $page = $data['page'] ?? 'landing';
        $categoryId = $data['category_id'] ?? null;
        $typeId = $data['product_type_id'] ?? null;
        abort_if($categoryId && $typeId, 422);
        if ($categoryId) {
            abort_unless($page === 'listing' && Category::query()->whereKey($categoryId)->where('is_active', true)->exists(), 404);
        }
        if ($typeId) {
            abort_unless($page === 'listing' && ProductType::query()->whereKey($typeId)->where('is_active', true)->exists(), 404);
        }
        $response = response()->json($cache->payload($page, $categoryId, $typeId));
        $response->setEtag(hash('sha256', $response->getContent()));
        $response->headers->set('Cache-Control', 'public, max-age=0, must-revalidate');
        $response->isNotModified($request);

        return $response;
    }
}
