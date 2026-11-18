<?php

namespace App\Console\Commands;

use App\Models\EmiCalculation;
use App\Services\EmiEnquiryDelivery;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;

class RetryEmiEnquiries extends Command
{
    protected $signature = 'emi:retry-enquiries';

    protected $description = 'Queue a bounded batch of pending or interrupted EMI notifications';

    public function handle(EmiEnquiryDelivery $delivery): int
    {
        if ($issue = $delivery->configurationIssue()) {
            $this->warn('EMI notifications unavailable: '.$issue);

            return self::SUCCESS;
        }
        $records = EmiCalculation::query()->whereNotNull('consented_at')->whereNull('notified_at')
            ->where(fn (Builder $q) => $q
                ->where(fn (Builder $q) => $q->whereIn('notification_status', ['pending', 'blocked'])->where('updated_at', '<=', now()->subMinutes(5)))
                ->orWhere(fn (Builder $q) => $q->where('notification_status', 'processing')->where('notification_locked_until', '<=', now())))
            ->orderBy('updated_at')->orderBy('id')->limit(100)->get(['id']);
        foreach ($records as $record) {
            $delivery->queue($record->id);
        }
        $this->info('Queued '.$records->count().' EMI notification recovery attempts.');

        return self::SUCCESS;
    }
}
