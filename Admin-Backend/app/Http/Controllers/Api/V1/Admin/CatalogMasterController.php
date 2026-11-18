<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCatalogMasterRequest;
use App\Http\Requests\UpdateCatalogMasterRequest;
use App\Http\Resources\CatalogMasterResource;
use App\Models\Brand;
use App\Models\Category;
use App\Models\ProductType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CatalogMasterController extends Controller
{
    public function index(string $master): AnonymousResourceCollection
    {
        abort_unless(request()->user()?->hasPermission('catalog.manage'), 403);

        $query = $this->queryFor($master);
        if (in_array($master, ['categories', 'product-types'], true)) {
            $query->with(['imageMedia:id,disk,path,original_filename,mime_type,size_bytes'])->orderBy('sort_order');
        }

        return CatalogMasterResource::collection($query->orderBy('name')->get());
    }

    public function store(StoreCatalogMasterRequest $request, string $master): CatalogMasterResource
    {
        $data = $request->safe()->only(['name', 'slug', 'description', 'is_active']);
        if (in_array($master, ['categories', 'product-types'], true)) {
            $data += $request->safe()->only(['image_media_id', 'sort_order']);
        }

        $model = match ($master) {
            'brands' => Brand::query()->create([
                'name' => $data['name'],
                'slug' => $data['slug'],
            ]),
            'product-types' => ProductType::query()->create($data),
            'categories' => Category::query()->create($data),
        };

        return new CatalogMasterResource(in_array($master, ['categories', 'product-types'], true) ? $model->load('imageMedia') : $model);
    }

    public function update(UpdateCatalogMasterRequest $request): CatalogMasterResource
    {
        // Route defaults follow URI parameters in the dispatcher; resolve by name.
        $master = (string) $request->route('master');
        $record = (string) $request->route('record');
        $model = $this->queryFor($master)->findOrFail($record);
        $data = $request->safe()->only(['name', 'slug', 'description', 'is_active']);
        if (in_array($master, ['categories', 'product-types'], true)) {
            $data += $request->safe()->only(['image_media_id', 'sort_order']);
        }

        if ($master === 'brands') {
            $model->update(['name' => $data['name'], 'slug' => $data['slug']]);
        } else {
            $model->update($data);
        }

        $model->refresh();

        return new CatalogMasterResource(in_array($master, ['categories', 'product-types'], true) ? $model->load('imageMedia') : $model);
    }

    /** @return Builder<Brand|Category|ProductType> */
    private function queryFor(string $master): Builder
    {
        return match ($master) {
            'brands' => Brand::query(),
            'product-types' => ProductType::query(),
            'categories' => Category::query(),
        };
    }
}
