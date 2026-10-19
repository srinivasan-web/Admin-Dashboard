<?php

namespace App\Http\Resources;

use App\Models\HsnCode;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin HsnCode */
class HsnCodeResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'type' => $this->type,
            'hsn_code' => $this->hsn_code,
            'sgst_tax_multiplier' => $this->sgst_tax_multiplier,
            'igst_tax_multiplier' => $this->igst_tax_multiplier,
        ];
    }
}
