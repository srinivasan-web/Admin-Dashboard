<?php

namespace App\Actions;

use App\Models\Category;
use Illuminate\Support\Facades\DB;

class SaveCategoryComparison
{
    public function execute(Category $category, array $specifications): void
    {
        DB::transaction(function () use ($category, $specifications): void {
            $ids = array_column($specifications, 'attribute_id');

            $category->specifications()->where('is_comparable', true)
                ->when($ids !== [], fn ($query) => $query->whereNotIn('attribute_id', $ids))
                ->update(['is_comparable' => false]);

            foreach ($specifications as $item) {
                $category->specifications()->updateOrCreate(
                    ['attribute_id' => $item['attribute_id']],
                    [
                        'label' => trim($item['label'] ?? '') ?: null,
                        'sort_order' => $item['sort_order'],
                        'is_active' => true,
                        'is_comparable' => true,
                    ],
                );
            }
        });
    }
}
