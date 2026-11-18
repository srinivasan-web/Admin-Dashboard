<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryFaqResource;
use App\Http\Resources\ShopBenefitResource;
use App\Models\CategoryFaq;
use App\Models\ShopBenefit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PublicProductContentController extends Controller
{
    public function faqs(Request $request): AnonymousResourceCollection
    {
        $data = $request->validate(['category_id' => ['required', 'uuid', 'exists:categories,id']]);

        return CategoryFaqResource::collection(CategoryFaq::query()
            ->where('is_active', true)
            ->where(fn (Builder $query) => $query->whereNull('category_id')
                ->orWhereHas('category', fn (Builder $category) => $category
                    ->whereKey($data['category_id'])->where('is_active', true)))
            ->orderBy('sort_order')->orderBy('id')->limit(50)->get());
    }

    public function shopBenefits(): AnonymousResourceCollection
    {
        return ShopBenefitResource::collection(ShopBenefit::query()
            ->where('is_active', true)->with('iconMedia:id,disk,path')
            ->orderBy('sort_order')->orderBy('id')->limit(24)->get());
    }
}
