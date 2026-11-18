<?php

namespace App\Http\Resources;

use App\Domain\Catalog\SpecificationValue;
use App\Services\ProductPurchaseQuote;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class ProductComparisonResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $price = app(ProductPurchaseQuote::class)->price($this->resource);

        return [
            'id' => $this->id,
            'name' => $this->name,
            'price' => ['currency' => $price['currency'], 'mrp' => $price['mrp'], 'sale' => $price['selling_price']],
            'images' => $this->images->map(fn ($image) => [
                'id' => $image->id, 'is_primary' => $image->is_primary, 'alt_text' => $image->alt_text,
                'url' => Storage::disk($image->media->disk)->url($image->media->path),
            ])->values(),
            'specifications' => ProductAttributeResource::collection($this->productAttributes
                ->filter(fn ($spec) => $spec->attribute?->is_active
                    && SpecificationValue::valid($spec->attribute->data_type, $spec->value))->values()),
        ];
    }
}
