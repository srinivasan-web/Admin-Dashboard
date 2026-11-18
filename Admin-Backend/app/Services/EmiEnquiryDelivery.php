<?php

namespace App\Services;

use App\Jobs\NotifyEmiEnquiry;
use App\Models\EmiCalculation;
use Illuminate\Support\Facades\DB;

class EmiEnquiryDelivery
{
    public function configurationIssue(): ?string
    {
        if (! filter_var(config('emi.notification_email'), FILTER_VALIDATE_EMAIL)) {
            return 'notification_recipient_missing';
        }
        $connection = config('emi.queue_connection');
        if (! in_array(config("queue.connections.$connection.driver"), ['database', 'redis', 'sqs', 'beanstalkd'], true)) {
            return 'asynchronous_queue_required';
        }
        $mailer = config('mail.default');
        $transport = config("mail.mailers.$mailer.transport");
        if (! in_array($transport, ['smtp', 'ses', 'ses-v2', 'postmark', 'resend', 'sendmail'], true)) {
            return 'notification_mailer_not_configured';
        }
        if (! filter_var(config('mail.from.address'), FILTER_VALIDATE_EMAIL)
            || str_ends_with((string) config('mail.from.address'), '@example.com')) {
            return 'notification_sender_missing';
        }
        if ($transport === 'smtp' && ! config("mail.mailers.$mailer.url") &&
            (! config("mail.mailers.$mailer.host") || in_array(config("mail.mailers.$mailer.host"), ['127.0.0.1', 'localhost'], true))) {
            return 'smtp_provider_not_configured';
        }
        if (in_array($transport, ['postmark', 'resend'], true) && ! config("services.$transport.key")) {
            return 'notification_credentials_missing';
        }

        return null;
    }

    public function queue(string $enquiryId): void
    {
        // A durable pending row is the outbox. The scheduled recovery command
        // retries it even if enqueueing fails after the HTTP transaction commits.
        DB::afterCommit(function () use ($enquiryId): void {
            try {
                NotifyEmiEnquiry::dispatch($enquiryId)->onConnection(config('emi.queue_connection'))->afterCommit();
            } catch (\Throwable) {
                // Do not log raw provider exceptions or customer contact data.
                EmiCalculation::query()->whereKey($enquiryId)->whereNull('notified_at')
                    ->update(['notification_error' => 'notification_enqueue_failed']);
            }
        });
    }
}
