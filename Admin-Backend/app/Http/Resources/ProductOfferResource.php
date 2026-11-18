<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductOfferResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $admin = $request->is('api/v1/admin/*');

        return [
            'id' => $this->id,
            'scope_type' => $this->scope_type,
            'product_id' => $this->when($admin, $this->product_id),
            'category_id' => $this->when($admin, $this->category_id),
            'product_type_id' => $this->when($admin, $this->product_type_id),
            'title' => $this->title,
            'description' => $this->description,
            'offer_type' => $this->offer_type,
            'coupon_code' => $this->coupon_code,
            'discount_type' => $this->discount_type,
            'discount_value' => $this->discount_value,
            'maximum_discount' => $this->maximum_discount,
            'minimum_order_amount' => $this->minimum_order_amount,
            'starts_at' => $this->starts_at?->toIso8601String(),
            'ends_at' => $this->ends_at?->toIso8601String(),
            'is_active' => $this->when($admin, $this->is_active),
            'sort_order' => $this->sort_order,
        ];
    }
}
