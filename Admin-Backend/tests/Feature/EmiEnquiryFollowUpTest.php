<?php

namespace Tests\Feature;

use App\Jobs\NotifyEmiEnquiry;
use App\Models\EmiCalculation;
use App\Models\EmiPlan;
use App\Models\EmiProvider;
use App\Models\Permission;
use App\Models\Product;
use App\Models\ProductEmiPlan;
use App\Models\Role;
use App\Models\User;
use App\Models\WarehouseStock;
use App\Services\EmiEnquiryDelivery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\Message;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Symfony\Component\Mime\Email;
use Tests\TestCase;

class EmiEnquiryFollowUpTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $product = Product::factory()->create(['mrp_price' => '30000.00', 'sale_price' => null]);
        WarehouseStock::factory()->create(['product_id' => $product->id, 'quantity' => 2]);
        $provider = EmiProvider::query()->create(['name' => 'Synthetic lender', 'code' => 'synthetic', 'is_active' => true]);
        $plan = EmiPlan::query()->create(['provider_id' => $provider->id, 'tenure_months' => 6, 'annual_interest_rate' => 0,
            'processing_fee' => 0, 'minimum_amount' => 0, 'is_active' => true]);
        ProductEmiPlan::query()->create(['product_id' => $product->id, 'emi_plan_id' => $plan->id, 'is_active' => true]);

        return [$product, $plan];
    }

    private function configured(): void
    {
        // Test configuration only; Mail is mocked, no message leaves the test process.
        config(['emi.notification_email' => 'operator@example.test', 'emi.queue_connection' => 'database',
            'mail.default' => 'smtp', 'mail.mailers.smtp.host' => 'mail.example.test', 'mail.from.address' => 'notifications@example.test']);
    }

    private function enquiry(): EmiCalculation
    {
        [$product, $plan] = $this->fixture();
        $response = $this->postJson('/api/v1/products/'.$product->id.'/emi/enquiries', [
            'plan_id' => $plan->id, 'mobile_number' => '9876543210', 'consent' => true, 'idempotency_key' => Str::uuid()->toString(),
        ])->assertCreated();

        return EmiCalculation::query()->findOrFail($response->json('data.id'));
    }

    private function manager(): User
    {
        $user = User::factory()->create();
        $role = Role::factory()->create();
        $role->permissions()->attach(Permission::factory()->create(['name' => 'catalog.manage']));
        $user->roles()->attach($role);

        return $user;
    }

    public function test_idempotent_replay_never_duplicates_records_even_after_plan_expires(): void
    {
        [$product, $plan] = $this->fixture();
        $url = '/api/v1/products/'.$product->id.'/emi/enquiries';
        $body = ['plan_id' => $plan->id, 'mobile_number' => '9876543210', 'consent' => true, 'idempotency_key' => Str::uuid()->toString()];
        $id = $this->postJson($url, $body)->assertCreated()->json('data.id');
        $plan->update(['is_active' => false]);
        $this->postJson($url, $body)->assertCreated()->assertJsonPath('data.id', $id);
        $this->assertDatabaseCount('emi_calculations', 1);
        $this->postJson($url, array_merge($body, ['mobile_number' => '9876543211']))->assertUnprocessable()->assertJsonValidationErrors('idempotency_key', 'error.details');
        $this->assertDatabaseCount('emi_calculations', 1);
    }

    public function test_missing_notification_configuration_stays_blocked_and_sends_nothing(): void
    {
        config(['emi.notification_email' => null]);
        Mail::fake();
        $record = $this->enquiry();
        $this->assertSame('blocked', $record->notification_status);
        (new NotifyEmiEnquiry($record->id))->handle(app(EmiEnquiryDelivery::class));
        Mail::assertNothingSent();
        $this->assertSame('notification_recipient_missing', $record->fresh()->notification_error);
        $this->assertNull($record->fresh()->notified_at);
    }

    public function test_notification_is_sent_once_and_never_includes_mobile_number(): void
    {
        $this->configured();
        $record = $this->enquiry();
        $calls = 0;
        Mail::shouldReceive('raw')->once()->andReturnUsing(function ($body, $callback) use (&$calls, $record): void {
            $calls++;
            $this->assertStringNotContainsString('9876543210', $body);
            $this->assertStringContainsString($record->id, $body);
            $callback(new Message(new Email));
        });
        $job = new NotifyEmiEnquiry($record->id);
        $job->handle(app(EmiEnquiryDelivery::class));
        $job->handle(app(EmiEnquiryDelivery::class));
        $this->assertSame(1, $calls);
        $this->assertSame('sent', $record->fresh()->notification_status);
        $this->assertNotNull($record->fresh()->notified_at);
        $this->assertStringNotContainsString('9876543210', serialize($job));
    }

    public function test_delivery_failure_is_sanitized_retryable_and_records_final_failure(): void
    {
        $this->configured();
        $record = $this->enquiry();
        Mail::shouldReceive('raw')->once()->andThrow(new \RuntimeException('Sensitive provider error with 9876543210'));
        $job = new NotifyEmiEnquiry($record->id);
        try {
            $job->handle(app(EmiEnquiryDelivery::class));
            $this->fail('Expected a retryable exception.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('EMI notification delivery failed.', $exception->getMessage());
        }
        $this->assertSame('pending', $record->fresh()->notification_status);
        $this->assertSame(1, $record->fresh()->notification_attempts);
        $this->assertNull($record->fresh()->notification_locked_until);
        $job->failed(new \RuntimeException('Provider failure'));
        $this->assertSame('failed', $record->fresh()->notification_status);
        $this->assertSame([60, 300, 900], $job->backoff());
    }

    public function test_admin_contact_reveal_and_notification_retry_require_permission(): void
    {
        config(['emi.notification_email' => null]);
        $record = $this->enquiry();
        $base = '/api/v1/admin/finance/emi-enquiries';
        $this->getJson($base)->assertUnauthorized();
        $this->actingAs(User::factory()->create());
        $this->getJson($base.'/'.$record->id)->assertForbidden();
        $this->postJson($base.'/'.$record->id.'/retry')->assertForbidden();
        $this->actingAs($this->manager());
        $this->getJson($base)->assertOk()->assertJsonPath('data.0.mobile_masked', '******3210')->assertJsonMissingPath('data.0.mobile_number');
        $this->getJson($base.'/'.$record->id)->assertOk()->assertJsonPath('data.mobile_number', '9876543210')->assertHeader('Cache-Control', 'no-store, private');
        $this->postJson($base.'/'.$record->id.'/retry')->assertOk()->assertJsonPath('data.notification_status', 'blocked');
        $record->update(['notified_at' => now(), 'notification_status' => 'sent']);
        $this->postJson($base.'/'.$record->id.'/retry')->assertStatus(409);
    }

    public function test_recovery_command_reports_missing_configuration_without_sending(): void
    {
        config(['emi.notification_email' => null]);
        Mail::fake();
        $this->enquiry();
        $this->artisan('emi:retry-enquiries')->expectsOutputToContain('notification_recipient_missing')->assertSuccessful();
        Mail::assertNothingSent();
    }

    public function test_active_delivery_lock_prevents_a_second_worker_from_sending(): void
    {
        $this->configured();
        Mail::fake();
        $record = $this->enquiry();
        $record->update(['notification_locked_until' => now()->addMinute()]);
        (new NotifyEmiEnquiry($record->id))->handle(app(EmiEnquiryDelivery::class));
        Mail::assertNothingSent();
    }

    public function test_configured_enquiry_enqueues_one_job_after_commit_and_replays_do_not_enqueue_again(): void
    {
        $this->configured();
        Queue::fake();
        [$product, $plan] = $this->fixture();
        $body = ['plan_id' => $plan->id, 'mobile_number' => '9876543210', 'consent' => true, 'idempotency_key' => Str::uuid()->toString()];
        $url = '/api/v1/products/'.$product->id.'/emi/enquiries';
        $this->postJson($url, $body)->assertCreated();
        $this->postJson($url, $body)->assertCreated();
        Queue::assertPushed(NotifyEmiEnquiry::class, 1);
        $this->assertDatabaseCount('emi_calculations', 1);
    }

    public function test_real_database_queue_encrypts_payload_and_worker_marks_notification_sent(): void
    {
        config(['emi.notification_email' => null]);
        $record = $this->enquiry();
        $this->configured();
        Mail::shouldReceive('raw')->once()->andReturnNull();
        $queue = app('queue')->connection('database');
        $queue->push(new NotifyEmiEnquiry($record->id));
        $payload = DB::table('jobs')->value('payload');
        $this->assertStringNotContainsString('9876543210', $payload);
        $this->assertStringNotContainsString($record->id, $payload);
        $job = $queue->pop();
        $this->assertNotNull($job);
        $job->fire();
        $this->assertSame('sent', $record->fresh()->notification_status);
        $this->assertDatabaseCount('jobs', 0);
    }
}
