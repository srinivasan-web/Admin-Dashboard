<?php

namespace App\Http\Resources;

use App\Models\CategoryProductListing;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin CategoryProductListing */
class CategoryListingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'category_id' => $this->category_id,
            'product' => [
                'id' => $this->product->id,
                'name' => $this->product->name,
                'sku' => $this->product->sku,
                'primary_category_id' => $this->product->category_id,
                'primary_category_name' => $this->product->category?->name,
            ],
            'sort_order' => $this->sort_order,
            'is_featured' => $this->is_featured,
            'is_active' => $this->is_active,
        ];
    }
}
