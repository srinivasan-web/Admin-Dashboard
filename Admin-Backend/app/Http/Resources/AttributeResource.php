<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AttributeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'slug' => $this->slug, 'icon' => $this->icon, 'description' => $this->description, 'data_type' => $this->data_type, 'unit' => $this->unit, 'is_filterable' => $this->is_filterable, 'is_active' => $this->is_active, 'sort_order' => $this->sort_order];
    }
}
