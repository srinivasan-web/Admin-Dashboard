<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Catalog\SpecificationValue;
use App\Http\Controllers\Controller;
use App\Http\Requests\PublicProductsRequest;
use App\Http\Resources\CatalogMasterResource;
use App\Http\Resources\ProductResource;
use App\Http\Resources\ProductOfferResource;
use App\Http\Resources\ProductComparisonResource;
use App\Models\Attribute;
use App\Models\Category;
use App\Models\MerchandisingSection;
use App\Models\Product;
use App\Models\ProductOffer;
use App\Models\ProductAttribute;
use App\Models\ProductType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;

class PublicCatalogController extends Controller
{
    private const EFFECTIVE_PRICE_SQL = 'CAST(COALESCE(sale_price, mrp_price) AS DECIMAL(12, 2))';

    public function merchandising(Request $request, string $placement): AnonymousResourceCollection
    {
        abort_unless(in_array($placement, ['featured', 'bestsellers'], true), 404);
        $limit = $request->validate(['limit' => ['sometimes', 'integer', 'min:1', 'max:12']])['limit'] ?? null;
        $section = MerchandisingSection::query()->where('slug', $placement)->where('is_active', true)->first();
        $products = $section?->products()
            ->wherePivot('is_active', true)
            ->where('products.is_active', true)
            ->whereHas('category', fn (Builder $query) => $query->where('is_active', true))
            ->whereHas('productType', fn (Builder $query) => $query->where('is_active', true))
            ->whereHas('warehouseStocks', fn (Builder $query) => $query->whereColumn('quantity', '>', 'reserved_quantity'))
            ->with(['brand', 'category', 'productType', 'images' => fn ($query) => $query->where('type', '!=', '360_frame'), 'images.media', 'productAttributes.attribute', 'highlights.productAttribute.attribute'])
            ->withCount(['images as rotation_frame_count' => fn ($query) => $query->where('type', '360_frame')])
            ->withSum('warehouseStocks', 'quantity')
            ->withSum('warehouseStocks', 'reserved_quantity')
            ->orderByPivot('sort_order')->orderBy('products.name')
            ->when($limit, fn (Builder $query) => $query->limit($limit))
            ->get();

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
            ->with(['brand', 'category', 'productType', 'images' => fn ($query) => $query->where('type', '!=', '360_frame'), 'images.media', 'productAttributes.attribute', 'highlights.productAttribute.attribute'])
            ->withCount(['images as rotation_frame_count' => fn ($query) => $query->where('type', '360_frame')])
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

    public function product(string $product): ProductResource
    {
        $product = $this->resolvePublicProduct($product);
        $product->loadMissing(['brand', 'category', 'productType']);

        abort_unless(
            $product->is_active
            && $product->category?->is_active
            && $product->productType?->is_active
            && $product->warehouseStocks()->whereColumn('quantity', '>', 'reserved_quantity')->exists(),
            404,
        );

        $product
            ->loadMissing([
                'images' => fn ($query) => $query
                    ->select(['id', 'product_id', 'media_id', 'type', 'sort_order', 'is_primary', 'alt_text'])
                    ->orderBy('sort_order')->orderBy('id'),
                'images.media:id,disk,path',
                'productAttributes' => fn ($query) => $query
                    ->select(['id', 'product_id', 'attribute_id', 'value', 'sort_order', 'show_on_top'])
                    ->whereHas('attribute', fn (Builder $attribute) => $attribute->where('is_active', true))
                    ->orderBy('sort_order')->orderBy('id'),
                'productAttributes.attribute:id,name,slug,icon,description,data_type,unit,is_filterable,is_active,sort_order',
                'highlights' => fn ($query) => $query
                    ->select(['id', 'product_id', 'product_attribute_id', 'sort_order', 'is_active'])
                    ->where('is_active', true)->orderBy('sort_order')->orderBy('id'),
                'details' => fn ($query) => $query
                    ->select(['id', 'product_id', 'title', 'content', 'sort_order', 'is_active'])
                    ->where('is_active', true)->orderBy('sort_order')->orderBy('id'),
                'additionalDetails:id,product_id,generic_name,model_number,net_quantity,country_of_origin,manufactured_by,marketed_by,consumer_complaints',
                'benefits' => fn ($query) => $query
                    ->select(['id', 'product_id', 'icon_media_id', 'title', 'description', 'benefit_type', 'sort_order', 'is_active'])
                    ->where('is_active', true)->orderBy('sort_order')->orderBy('id'),
                'benefits.iconMedia:id,disk,path',
            ])
            ->loadSum('warehouseStocks', 'quantity')
            ->loadSum('warehouseStocks', 'reserved_quantity');

        // Highlights reference this product's specifications; never reload or copy values.
        // An invalid/cross-product reference resolves to null and is excluded by the resource.
        $specifications = $product->productAttributes->keyBy('id');
        foreach ($product->highlights as $highlight) {
            $highlight->setRelation('productAttribute', $specifications->get($highlight->product_attribute_id));
        }

        return new ProductResource($product);
    }

    public function offers(string $product): AnonymousResourceCollection
    {
        $product = $this->resolvePublicProduct($product);
        $product->loadMissing(['category', 'productType']);
        abort_unless($product->is_active
            && $product->category?->is_active
            && $product->productType?->is_active
            && $product->warehouseStocks()->whereColumn('quantity', '>', 'reserved_quantity')->exists(), 404);

        $now = now();
        $offers = ProductOffer::query()
            ->where('is_active', true)
            ->where(fn (Builder $query) => $query
                ->where(fn (Builder $scope) => $scope->where('scope_type', 'product')->where('product_id', $product->id))
                ->orWhere(fn (Builder $scope) => $scope->where('scope_type', 'category')->where('category_id', $product->category_id))
                ->orWhere(fn (Builder $scope) => $scope->where('scope_type', 'product_type')->where('product_type_id', $product->product_type_id)))
            ->where(fn (Builder $query) => $query->whereNull('starts_at')->orWhere('starts_at', '<=', $now))
            ->where(fn (Builder $query) => $query->whereNull('ends_at')->orWhere('ends_at', '>=', $now))
            ->orderBy('sort_order')->orderBy('id')->limit(20)->get();

        // No related models are serialized, so this bounded read has no N+1 queries.
        return ProductOfferResource::collection($offers);
    }

    public function buyItWith(string $product): AnonymousResourceCollection
    {
        $product = $this->resolvePublicProduct($product);
        $product->loadMissing(['category', 'productType']);
        abort_unless($product->is_active
            && $product->category?->is_active
            && $product->productType?->is_active
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
            ->with(['brand', 'category', 'productType', 'images' => fn ($query) => $query->where('type', '!=', '360_frame'), 'images.media', 'productAttributes.attribute', 'highlights.productAttribute.attribute'])
            ->withCount(['images as rotation_frame_count' => fn ($query) => $query->where('type', '360_frame')])
            ->withSum('warehouseStocks', 'quantity')
            ->withSum('warehouseStocks', 'reserved_quantity')
            ->orderBy('name')->get();

        return ProductResource::collection($related);
    }

    public function comparison(string $product): JsonResponse
    {
        $product = $this->resolvePublicProduct($product);
        $product->loadMissing(['category', 'productType']);
        abort_unless($product->is_active && $product->category?->is_active
            && $product->productType?->is_active
            && $product->warehouseStocks()->whereColumn('quantity', '>', 'reserved_quantity')->exists(), 404);

        // Category configuration chooses the rows; values stay in product_attributes.
        $configuration = $product->category->specifications()
            ->where('is_active', true)->where('is_comparable', true)
            ->whereHas('attribute', fn (Builder $query) => $query->where('is_active', true))
            ->with('attribute:id,name,unit')
            ->orderBy('sort_order')->orderBy('id')
            ->limit(24)
            ->get(['id', 'category_id', 'attribute_id', 'label', 'sort_order']);

        // An admin can deliberately disable comparison by saving no comparable rows.
        // Only a category with no configuration at all uses its saved product values.
        $useSavedSpecifications = $configuration->isEmpty()
            && ! $product->category->specifications()->exists();
        if ($configuration->isEmpty() && ! $useSavedSpecifications) {
            return response()->json(['data' => ['attributes' => [], 'products' => []]]);
        }

        $products = Product::query()
            ->whereKeyNot($product->id)
            ->where('category_id', $product->category_id)
            ->where('product_type_id', $product->product_type_id)
            ->where('is_active', true)
            ->whereHas('warehouseStocks', fn (Builder $query) => $query->whereColumn('quantity', '>', 'reserved_quantity'))
            ->orderBy('sort_order')->orderBy('name')->orderBy('id')
            ->limit(3)->get(['id', 'name', 'mrp_price', 'sale_price'])
            ->prepend($product);

        $attributes = $configuration->map(fn ($row) => [
            'id' => $row->attribute_id,
            'name' => trim($row->label ?? '') ?: $row->attribute->name,
            'unit' => $row->attribute->unit,
        ]);
        if ($useSavedSpecifications) {
            $savedValues = fn ($ids) => ProductAttribute::query()
                ->whereIn('product_id', $ids)
                ->whereHas('attribute', fn (Builder $query) => $query->where('is_active', true))
                ->with('attribute:id,name,unit,data_type,is_active')
                ->orderBy('sort_order')->orderBy('id')->limit(48)->get()
                ->filter(fn (ProductAttribute $specification) => SpecificationValue::valid(
                    $specification->attribute->data_type, $specification->value,
                ))
                ->unique('attribute_id')->take(24);
            $saved = $savedValues([$product->id]);
            if ($saved->isEmpty()) {
                $saved = $savedValues($products->skip(1)->pluck('id'));
            }
            $attributes = $saved->map(fn (ProductAttribute $specification) => [
                'id' => $specification->attribute_id,
                'name' => $specification->attribute->name,
                'unit' => $specification->attribute->unit,
            ])->values();
        }
        if ($attributes->isEmpty()) {
            return response()->json(['data' => ['attributes' => [], 'products' => []]]);
        }

        $attributeIds = $attributes->pluck('id');

        // Keep the source first without a CASE sort over all eligible products.
        $products->load([
                'images' => fn ($query) => $query
                    ->select(['id', 'product_id', 'media_id', 'is_primary', 'alt_text', 'sort_order'])
                    ->where('type', '!=', '360_frame')
                    ->orderByDesc('is_primary')->orderBy('sort_order')->orderBy('id')->limit(1),
                'images.media:id,disk,path',
                'productAttributes' => fn ($query) => $query
                    ->select(['id', 'product_id', 'attribute_id', 'value', 'sort_order', 'show_on_top'])
                    ->whereIn('attribute_id', $attributeIds),
                'productAttributes.attribute:id,name,slug,icon,description,data_type,unit,is_filterable,is_active,sort_order',
        ]);

        return response()->json(['data' => [
            'attributes' => $attributes,
            'products' => ProductComparisonResource::collection($products),
        ]]);
    }

    private function resolvePublicProduct(string $identifier): Product
    {
        if (Str::isUuid($identifier)) {
            return Product::query()->findOrFail($identifier);
        }

        abort_unless(preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $identifier) === 1, 404);

        return Product::query()->where('slug', $identifier)->firstOrFail();
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
