<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\AttributeRequest;
use App\Http\Resources\AttributeResource;
use App\Models\Attribute;

class AttributeController extends Controller
{
    public function index()
    {
        abort_unless(request()->user()?->hasPermission('catalog.manage'), 403);

        return AttributeResource::collection(Attribute::query()->orderBy('sort_order')->orderBy('name')->get());
    }

    public function store(AttributeRequest $request)
    {
        return new AttributeResource(Attribute::query()->create($request->validated()));
    }

    public function update(Attribute $attribute, AttributeRequest $request)
    {
        $attribute->update($request->validated());

        return new AttributeResource($attribute->fresh());
    }
}
