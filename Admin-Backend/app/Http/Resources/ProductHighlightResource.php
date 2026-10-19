<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductHighlightResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'product_attribute_id' => $this->product_attribute_id, 'sort_order' => $this->sort_order, 'is_active' => $this->is_active, 'specification' => ProductAttributeResource::make($this->whenLoaded('productAttribute'))];
    }
}
