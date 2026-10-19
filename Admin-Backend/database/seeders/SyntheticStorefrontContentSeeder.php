<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/** Opt-in development fixtures only. Intentionally absent from DatabaseSeeder. */
class SyntheticStorefrontContentSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('Synthetic storefront content is permitted only in local/testing environments.');
        }

        DB::transaction(function (): void {
            foreach (['shop_benefits', 'why_choose_us'] as $table) {
                $title = 'SYNTHETIC '.$table.' example — not customer content';
                if (! DB::table($table)->where('title', $title)->exists()) {
                    DB::table($table)->insert([
                        'id' => (string) Str::uuid(), 'title' => $title,
                        'description' => 'Fixture only. No shipping, payment or installation promise.',
                        'is_active' => false, 'sort_order' => 0,
                        'created_at' => now(), 'updated_at' => now(),
                    ]);
                }
            }
        });
    }
}
