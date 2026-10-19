<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\ManageMerchandisingProduct;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMerchandisingProductRequest;
use App\Http\Requests\UpdateMerchandisingProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\MerchandisingSection;
use App\Models\Product;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class MerchandisingController extends Controller
{
    public function index(string $placement): JsonResponse
    {
        abort_unless(request()->user()?->hasPermission('catalog.manage'), 403);

        $section = MerchandisingSection::query()->where('slug', $this->placement($placement))->first();
        $items = $section?->products()
            ->with(['brand', 'category', 'productType', 'images.media'])
            ->withSum('warehouseStocks', 'quantity')
            ->withSum('warehouseStocks', 'reserved_quantity')
            ->orderByPivot('sort_order')->orderBy('products.name')->get();

        return response()->json(['data' => [
            'section' => $section?->only(['id', 'name', 'slug', 'is_active']),
            'items' => $items?->map(fn (Product $product): array => [
                'product' => (new ProductResource($product))->resolve(),
                'sort_order' => $product->pivot->sort_order,
                'is_active' => (bool) $product->pivot->is_active,
            ])->all() ?? [],
        ]]);
    }

    public function eligible(Request $request, string $placement): AnonymousResourceCollection
    {
        abort_unless($request->user()?->hasPermission('catalog.manage'), 403);
        $this->placement($placement);
        $validated = $request->validate([
            'product_type_id' => ['nullable', 'uuid'],
            'category_id' => ['nullable', 'uuid'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        return ProductResource::collection(Product::query()
            ->where('is_active', true)
            ->whereHas('productType', fn (Builder $query) => $query->where('is_active', true))
            ->whereHas('category', fn (Builder $query) => $query->where('is_active', true))
            ->when($validated['product_type_id'] ?? null, fn (Builder $query, string $id) => $query->where('product_type_id', $id))
            ->when($validated['category_id'] ?? null, fn (Builder $query, string $id) => $query->where('category_id', $id))
            ->when($validated['search'] ?? null, fn (Builder $query, string $search) => $query->where(function (Builder $query) use ($search): void {
                $query->where('name', 'like', '%'.$search.'%')->orWhere('sku', 'like', '%'.$search.'%');
            }))
            ->with(['brand', 'category', 'productType', 'images.media'])
            ->withSum('warehouseStocks', 'quantity')
            ->withSum('warehouseStocks', 'reserved_quantity')
            ->orderBy('name')->orderBy('id')->paginate(20));
    }

    public function store(string $placement, StoreMerchandisingProductRequest $request, ManageMerchandisingProduct $manage): JsonResponse
    {
        $section = $manage->add($this->placement($placement), $request->validated());

        return response()->json(['data' => ['section_id' => $section->id]], 201);
    }

    public function update(string $placement, Product $product, UpdateMerchandisingProductRequest $request, ManageMerchandisingProduct $manage): JsonResponse
    {
        $section = MerchandisingSection::query()->where('slug', $this->placement($placement))->firstOrFail();
        $manage->update($section, $product, $request->validated());

        return response()->json(['data' => ['product_id' => $product->id]]);
    }

    public function destroy(string $placement, Product $product, ManageMerchandisingProduct $manage): JsonResponse
    {
        abort_unless(request()->user()?->hasPermission('catalog.manage'), 403);
        $section = MerchandisingSection::query()->where('slug', $this->placement($placement))->firstOrFail();
        $manage->remove($section, $product);

        return response()->json(['data' => null]);
    }

    private function placement(string $placement): string
    {
        abort_unless(in_array($placement, ['featured', 'bestsellers'], true), 404);

        return $placement;
    }
}
