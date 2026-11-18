<?php

namespace App\Http\Resources;

use App\Domain\Catalog\ProductEditToken;
use App\Domain\Catalog\SpecificationValue;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** @mixin Product */
class ProductResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $admin = $request->is('api/v1/admin/*');
        $eligible = fn ($specification) => $specification && $specification->product_id === $this->id && $specification->attribute?->is_active && SpecificationValue::valid($specification->attribute->data_type, $specification->value);

        return [
            'id' => $this->id,
            'edit_token' => $this->when($request->is('api/v1/admin/*'), fn () => ProductEditToken::for($this->resource)),
            'name' => $this->name,
            'sku' => $this->sku,
            'group_name' => $this->group_name,
            'description' => $this->description,
            'slug' => $this->slug,
            'short_description' => $this->short_description,
            'tag' => $this->tag,
            'is_active' => $this->is_active,
            'is_trade_product' => $this->is_trade_product,
            'sort_order' => $this->sort_order,
            'price' => [
                'currency' => 'INR',
                'mrp' => $this->mrp_price,
                'sale' => $this->sale_price,
            ],
            'category' => CatalogMasterResource::make($this->whenLoaded('category')),
            'product_type' => CatalogMasterResource::make($this->whenLoaded('productType')),
            'brand' => CatalogMasterResource::make($this->whenLoaded('brand')),
            'hsn_code' => HsnCodeResource::make($this->whenLoaded('hsnCode')),
            'images' => $this->whenLoaded('images', fn () => $this->images->sortBy('sort_order')->values()->map(fn ($image) => [
                'id' => $image->id,
                'type' => $image->type,
                'sort_order' => $image->sort_order,
                'is_primary' => $image->is_primary,
                'alt_text' => $image->alt_text,
                'url' => Storage::disk($image->media->disk)->url($image->media->path),
            ])),
            'has_360_view' => $this->when(
                array_key_exists('rotation_frame_count', $this->resource->getAttributes()) || $this->resource->relationLoaded('images'),
                fn () => array_key_exists('rotation_frame_count', $this->resource->getAttributes())
                    ? (int) $this->rotation_frame_count >= 8
                    : $this->images->where('type', '360_frame')->count() >= 8,
            ),
            'details' => $this->whenLoaded('details', fn () => $this->details
                ->filter(fn ($detail) => $admin || $detail->is_active)
                ->sortBy(fn ($detail) => [$detail->sort_order, $detail->id])->values()
                ->map(fn ($detail) => [
                    'id' => $detail->id,
                    'title' => $detail->title,
                    'content' => $detail->content,
                    'sort_order' => $detail->sort_order,
                    'is_active' => $detail->is_active,
                ])),
            'additional_details' => $this->whenLoaded('additionalDetails', fn () => $this->additionalDetails ? [
                'generic_name' => $this->additionalDetails->generic_name,
                'model_number' => $this->additionalDetails->model_number,
                'net_quantity' => $this->additionalDetails->net_quantity,
                'country_of_origin' => $this->additionalDetails->country_of_origin,
                'manufactured_by' => $this->additionalDetails->manufactured_by,
                'marketed_by' => $this->additionalDetails->marketed_by,
                'consumer_complaints' => $this->additionalDetails->consumer_complaints,
            ] : null),
            'benefits' => $this->whenLoaded('benefits', fn () => $this->benefits
                ->filter(fn ($benefit) => $admin || $benefit->is_active)
                ->sortBy(fn ($benefit) => [$benefit->sort_order, $benefit->id])->values()
                ->map(fn ($benefit) => [
                    'id' => $benefit->id,
                    'title' => $benefit->title,
                    'description' => $benefit->description,
                    'benefit_type' => $benefit->benefit_type,
                    'sort_order' => $benefit->sort_order,
                    'is_active' => $benefit->is_active,
                    'icon_url' => $benefit->iconMedia
                        ? Storage::disk($benefit->iconMedia->disk)->url($benefit->iconMedia->path)
                        : null,
                ])),
            'available_stock' => $this->when(
                array_key_exists('warehouse_stocks_sum_quantity', $this->resource->getAttributes()) && array_key_exists('warehouse_stocks_sum_reserved_quantity', $this->resource->getAttributes()),
                fn () => max(0, (int) $this->warehouse_stocks_sum_quantity - (int) $this->warehouse_stocks_sum_reserved_quantity),
            ),
            'inventory' => $this->when(
                $request->is('api/v1/admin/*') && $this->resource->relationLoaded('warehouseStocks'),
                function (): array {
                    $stocks = $this->warehouseStocks->sortBy(fn ($stock) => $stock->warehouse?->name)->values();

                    return [
                        'physical' => (int) $stocks->sum('quantity'),
                        'reserved' => (int) $stocks->sum('reserved_quantity'),
                        'available' => (int) $stocks->sum('available_quantity'),
                        'warehouses' => $stocks->map(fn ($stock) => [
                            'warehouse_id' => $stock->warehouse_id,
                            'warehouse_name' => $stock->warehouse?->name,
                            'physical' => $stock->quantity,
                            'reserved' => $stock->reserved_quantity,
                            'available' => $stock->available_quantity,
                        ])->all(),
                    ];
                },
            ),
            'specifications' => ProductAttributeResource::collection($this->whenLoaded('productAttributes', fn () => $this->productAttributes->filter(fn ($specification) => $admin || $eligible($specification))->sortBy('sort_order')->values())),
            'highlights' => ProductHighlightResource::collection($this->whenLoaded('highlights', fn () => $this->highlights->filter(fn ($highlight) => $admin || ($highlight->is_active && $highlight->product_id === $this->id && $eligible($highlight->productAttribute)))->sortBy('sort_order')->values())),
        ];
    }
}
