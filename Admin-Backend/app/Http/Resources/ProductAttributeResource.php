<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductAttributeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'attribute' => AttributeResource::make($this->whenLoaded('attribute')), 'value' => $this->value, 'sort_order' => $this->sort_order, 'show_on_top' => $this->show_on_top];
    }
}
