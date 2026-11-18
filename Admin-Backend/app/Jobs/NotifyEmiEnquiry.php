<?php

namespace App\Jobs;

use App\Models\EmiCalculation;
use App\Services\EmiEnquiryDelivery;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Mail\Message;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
use Throwable;

class NotifyEmiEnquiry implements ShouldBeEncrypted, ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public int $timeout = 30;

    public int $uniqueFor = 3600;

    public function __construct(public string $enquiryId) {}

    public function uniqueId(): string
    {
        return $this->enquiryId;
    }

    public function backoff(): array
    {
        return [60, 300, 900];
    }

    public function handle(EmiEnquiryDelivery $delivery): void
    {
        $record = DB::transaction(function () use ($delivery) {
            $record = EmiCalculation::query()->lockForUpdate()->find($this->enquiryId);
            if (! $record || ! $record->consented_at || $record->notified_at) {
                return null;
            }
            if ($record->notification_locked_until?->isFuture()) {
                $this->release(60);

                return null;
            }
            if ($issue = $delivery->configurationIssue()) {
                $record->update(['notification_status' => 'blocked', 'notification_error' => $issue, 'notification_locked_until' => null]);

                return null;
            }
            $record->update(['notification_status' => 'processing', 'notification_error' => null,
                'notification_attempts' => $record->notification_attempts + 1, 'notification_locked_until' => now()->addSeconds(60)]);

            return $record;
        });
        if (! $record) {
            return;
        }

        try {
            // No mobile number is placed in email, queue payloads or logs.
            // Operators open the authenticated enquiry screen for contact data.
            Mail::raw("A consented EMI callback enquiry is awaiting follow-up.\nReference: {$record->id}\nOpen Admin → EMI & Flash Sales → Enquiries to review it.", function (Message $message) use ($record): void {
                $message->to(config('emi.notification_email'))->subject('New EMI callback enquiry');
                // SMTP retries are at-least-once; keep a stable reference for deduplication.
                $message->getSymfonyMessage()->getHeaders()->addIdHeader('Message-ID', $record->id.'@durafit-emi.local');
            });
            $record->update(['notification_status' => 'sent', 'notification_error' => null, 'notification_locked_until' => null, 'notified_at' => now()]);
        } catch (Throwable) {
            $record->update(['notification_status' => 'pending', 'notification_error' => 'notification_delivery_failed', 'notification_locked_until' => null]);
            throw new RuntimeException('EMI notification delivery failed.');
        }
    }

    public function failed(?Throwable $exception): void
    {
        EmiCalculation::query()->whereKey($this->enquiryId)->whereNull('notified_at')
            ->update(['notification_status' => 'failed', 'notification_error' => 'notification_delivery_failed', 'notification_locked_until' => null]);
    }
}
