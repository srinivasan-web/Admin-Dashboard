<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Catalog\SpecificationValue;
use App\Http\Controllers\Controller;
use App\Http\Requests\PublicProductsRequest;
use App\Http\Resources\CatalogMasterResource;
use App\Http\Resources\ProductResource;
use App\Models\Attribute;
use App\Models\Category;
use App\Models\MerchandisingSection;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PublicCatalogController extends Controller
{
    private const EFFECTIVE_PRICE_SQL = 'CAST(COALESCE(sale_price, mrp_price) AS DECIMAL(12, 2))';

    public function merchandising(string $placement): AnonymousResourceCollection
    {
        abort_unless(in_array($placement, ['featured', 'bestsellers'], true), 404);
        $section = MerchandisingSection::query()->where('slug', $placement)->where('is_active', true)->first();
        $products = $section?->products()
            ->wherePivot('is_active', true)
            ->where('products.is_active', true)
            ->whereHas('category', fn (Builder $query) => $query->where('is_active', true))
            ->whereHas('productType', fn (Builder $query) => $query->where('is_active', true))
            ->whereHas('warehouseStocks', fn (Builder $query) => $query->whereColumn('quantity', '>', 'reserved_quantity'))
            ->with(['brand', 'category', 'productType', 'images.media', 'productAttributes.attribute', 'highlights.productAttribute.attribute'])
            ->withSum('warehouseStocks', 'quantity')
            ->withSum('warehouseStocks', 'reserved_quantity')
            ->orderByPivot('sort_order')->orderBy('products.name')->get();

        return ProductResource::collection($products ?? collect());
    }

    public function products(PublicProductsRequest $request): AnonymousResourceCollection
    {
        $validated = $request->validated();

        $products = Product::query()
            ->where('is_active', true)
            ->whereHas('category', fn (Builder $query) => $query->where('is_active', true))
            ->whereHas('productType', fn (Builder $query) => $query->where('is_active', true))
            ->whereHas('warehouseStocks', fn (Builder $query) => $query->whereColumn('quantity', '>', 'reserved_quantity'))
            ->when($validated['category_id'] ?? null, fn (Builder $query, string $categoryId) => $query->where(function (Builder $query) use ($categoryId): void {
                $query->where('category_id', $categoryId)
                    ->orWhereHas('categoryListingPlacements', fn (Builder $placement) => $placement
                        ->where('category_id', $categoryId)->where('is_active', true)
                        ->whereHas('category', fn (Builder $category) => $category->where('is_active', true)));
            }))
            ->when($validated['product_type_id'] ?? null, fn (Builder $query, string $typeId) => $query->where('product_type_id', $typeId))
            ->when(isset($validated['min_price']), fn (Builder $query) => $query->whereRaw(self::EFFECTIVE_PRICE_SQL.' >= ?', [$validated['min_price']]))
            ->when(isset($validated['max_price']), fn (Builder $query) => $query->whereRaw(self::EFFECTIVE_PRICE_SQL.' <= ?', [$validated['max_price']]))
            ->when($validated['q'] ?? null, fn (Builder $query, string $search) => $query->where(function (Builder $query) use ($search): void {
                $query->where('name', 'like', '%'.$search.'%')->orWhere('sku', 'like', '%'.$search.'%');
            }))
            ->with(['brand', 'category', 'productType', 'images.media', 'productAttributes.attribute', 'highlights.productAttribute.attribute'])
            ->withSum('warehouseStocks', 'quantity');
        $products->withSum('warehouseStocks', 'reserved_quantity');
        foreach ($validated['attributes'] ?? [] as $attributeId => $values) {
            // AND across attributes, OR across the selected values of one attribute.
            $products->whereHas('productAttributes', fn (Builder $query) => $query->where('attribute_id', $attributeId)->whereIn('value', $values));
        }

        if ($validated['category_id'] ?? null) {
            $categoryId = $validated['category_id'];
            $activePlacement = fn (Builder $query) => $query->where('category_id', $categoryId)->where('is_active', true);
            $products->withExists(['categoryListingPlacements as category_curated' => $activePlacement])
                ->withMin(['categoryListingPlacements as category_display_order' => $activePlacement], 'sort_order');
        }

        match ($validated['sort'] ?? 'name') {
            'price_asc' => $products->orderByRaw(self::EFFECTIVE_PRICE_SQL.' ASC')->orderBy('id'),
            'price_desc' => $products->orderByRaw(self::EFFECTIVE_PRICE_SQL.' DESC')->orderBy('id'),
            default => $products
                ->when($validated['category_id'] ?? null, fn (Builder $query) => $query
                    ->orderByDesc('category_curated')->orderBy('category_display_order'))
                ->orderBy('sort_order')->orderBy('name')->orderBy('id'),
        };

        return ProductResource::collection($products->paginate(24)->withQueryString());
    }

    public function product(Product $product): ProductResource
    {
        $product->loadMissing(['brand', 'category', 'productType']);

        abort_unless(
            $product->is_active
            && $product->category->is_active
            && $product->productType->is_active
            && $product->warehouseStocks()->whereColumn('quantity', '>', 'reserved_quantity')->exists(),
            404,
        );

        return new ProductResource($product
            ->loadMissing(['images.media', 'productAttributes.attribute', 'highlights.productAttribute.attribute', 'details', 'additionalDetails'])
            ->loadSum('warehouseStocks', 'quantity')
            ->loadSum('warehouseStocks', 'reserved_quantity'));
    }

    public function buyItWith(Product $product): AnonymousResourceCollection
    {
        abort_unless($product->is_active
            && $product->category->is_active
            && $product->productType->is_active
            && $product->warehouseStocks()->whereColumn('quantity', '>', 'reserved_quantity')->exists(), 404);

        $comboIds = $product->combos()->where('combos.is_active', true)->pluck('combos.id');
        if ($comboIds->isEmpty()) {
            return ProductResource::collection(collect());
        }

        $related = Product::query()
            ->where('products.id', '!=', $product->getKey())
            ->where('is_active', true)
            ->whereHas('combos', fn (Builder $query) => $query->whereIn('combos.id', $comboIds))
            ->whereHas('category', fn (Builder $query) => $query->where('is_active', true))
            ->whereHas('productType', fn (Builder $query) => $query->where('is_active', true))
            ->whereHas('warehouseStocks', fn (Builder $query) => $query->whereColumn('quantity', '>', 'reserved_quantity'))
            ->with(['brand', 'category', 'productType', 'images.media', 'productAttributes.attribute', 'highlights.productAttribute.attribute'])
            ->withSum('warehouseStocks', 'quantity')
            ->withSum('warehouseStocks', 'reserved_quantity')
            ->orderBy('name')->get();

        return ProductResource::collection($related);
    }

    public function categories(): AnonymousResourceCollection
    {
        return CatalogMasterResource::collection(Category::query()->where('is_active', true)
            ->with('imageMedia')->orderBy('sort_order')->orderBy('name')->get());
    }

    public function productTypes(): AnonymousResourceCollection
    {
        return CatalogMasterResource::collection(ProductType::query()->where('is_active', true)
            ->with('imageMedia')->orderBy('sort_order')->orderBy('name')->get());
    }

    public function filters(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['nullable', 'uuid'],
            'product_type_id' => ['nullable', 'uuid'],
        ]);
        $visible = fn (Builder $query) => $query->where('is_active', true)
            ->when($data['category_id'] ?? null, fn (Builder $products, string $id) => $products->where(function (Builder $products) use ($id): void {
                $products->where('category_id', $id)
                    ->orWhereHas('categoryListingPlacements', fn (Builder $placement) => $placement
                        ->where('category_id', $id)->where('is_active', true)
                        ->whereHas('category', fn (Builder $category) => $category->where('is_active', true)));
            }))
            ->when($data['product_type_id'] ?? null, fn (Builder $products, string $id) => $products->where('product_type_id', $id))
            ->whereHas('category', fn (Builder $category) => $category->where('is_active', true))
            ->whereHas('productType', fn (Builder $type) => $type->where('is_active', true))
            ->whereHas('warehouseStocks', fn (Builder $stock) => $stock->whereColumn('quantity', '>', 'reserved_quantity'));
        $attributes = Attribute::query()->where('is_active', true)->where('is_filterable', true)
            ->orderBy('sort_order')->orderBy('name')
            ->get(['id', 'name', 'slug', 'unit', 'data_type']);

        if ($attributes->isEmpty()) {
            return response()->json(['data' => []]);
        }

        // Query only distinct display values; do not hydrate every matching product specification.
        $values = ProductAttribute::query()
            ->whereIn('attribute_id', $attributes->pluck('id'))
            ->whereHas('product', $visible)
            ->select('attribute_id', 'value')
            ->distinct()
            ->orderBy('attribute_id')
            ->orderBy('value')
            ->toBase()
            ->get()
            ->groupBy('attribute_id');

        $filters = $attributes
            ->filter(fn (Attribute $attribute) => $values->has($attribute->id))
            ->map(fn (Attribute $attribute) => [
                'id' => $attribute->id,
                'name' => $attribute->name,
                'slug' => $attribute->slug,
                'unit' => $attribute->unit,
                'values' => $values->get($attribute->id)->pluck('value')->filter(fn (string $value) => SpecificationValue::valid($attribute->data_type, $value))->values(),
            ])
            ->filter(fn (array $filter) => $filter['values']->isNotEmpty())
            ->values();

        return response()->json(['data' => $filters]);
    }
}
