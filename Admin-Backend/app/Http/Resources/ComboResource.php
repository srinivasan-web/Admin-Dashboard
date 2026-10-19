<?php

namespace App\Http\Resources;

use App\Models\Combo;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Combo */
class ComboResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'is_active' => $this->is_active,
            'items' => $this->whenLoaded('products', fn () => $this->products->map(fn ($product) => [
                'product_id' => $product->id,
                'name' => $product->name,
                'sku' => $product->sku,
                'quantity' => $product->pivot->quantity,
            ])),
        ];
    }
}
