<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreHsnCodeRequest;
use App\Http\Requests\UpdateHsnCodeRequest;
use App\Http\Resources\HsnCodeResource;
use App\Models\HsnCode;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class HsnCodeController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        abort_unless(request()->user()?->hasPermission('catalog.manage'), 403);

        return HsnCodeResource::collection(HsnCode::query()->orderBy('title')->get());
    }

    public function store(StoreHsnCodeRequest $request): HsnCodeResource
    {
        return new HsnCodeResource(HsnCode::query()->create($request->validated()));
    }

    public function update(HsnCode $hsnCode, UpdateHsnCodeRequest $request): HsnCodeResource
    {
        $hsnCode->update($request->validated());

        return new HsnCodeResource($hsnCode->fresh());
    }
}
