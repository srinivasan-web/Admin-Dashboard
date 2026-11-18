<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\EmiCalculation;
use App\Services\EmiEnquiryDelivery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EmiEnquiryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('catalog.manage'), 403);
        $input = $request->validate(['page' => ['sometimes', 'integer', 'min:1'], 'status' => ['sometimes', 'in:pending,blocked,processing,sent,failed']]);
        $page = EmiCalculation::query()->with('product:id,name')->when($input['status'] ?? null, fn ($q, $status) => $q->where('notification_status', $status))
            ->orderByDesc('created_at')->orderBy('id')->paginate(20)
            ->through(fn ($record) => $this->summary($record));

        return response()->json($page)->header('Cache-Control', 'no-store');
    }

    public function show(Request $request, EmiCalculation $enquiry): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('catalog.manage'), 403);

        return response()->json(['data' => $this->summary($enquiry->load('product:id,name')) + ['mobile_number' => $enquiry->mobile_number, 'quote' => $enquiry->quote]])
            ->header('Cache-Control', 'no-store');
    }

    public function retry(Request $request, EmiCalculation $enquiry, EmiEnquiryDelivery $delivery): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('catalog.manage'), 403);
        DB::transaction(function () use ($enquiry, $delivery): void {
            $record = EmiCalculation::query()->lockForUpdate()->findOrFail($enquiry->id);
            abort_if($record->notified_at || $record->notification_locked_until?->isFuture(), 409, 'This notification was already sent or is being processed.');
            abort_unless($record->consented_at, 422, 'Customer consent is required.');
            $issue = $delivery->configurationIssue();
            $record->update(['notification_status' => $issue ? 'blocked' : 'pending', 'notification_error' => $issue, 'notification_locked_until' => null]);
            if (! $issue) {
                $delivery->queue($record->id);
            }
        });

        return response()->json(['data' => $this->summary($enquiry->fresh()->load('product:id,name'))])->header('Cache-Control', 'no-store');
    }

    private function summary(EmiCalculation $record): array
    {
        return ['id' => $record->id, 'product_id' => $record->product_id, 'product_name' => $record->product?->name,
            'mobile_masked' => '******'.substr($record->mobile_number, -4), 'notification_status' => $record->notification_status,
            'notification_error' => $record->notification_error, 'notification_attempts' => $record->notification_attempts,
            'consented_at' => $record->consented_at?->toIso8601String(), 'notified_at' => $record->notified_at?->toIso8601String(),
            'created_at' => $record->created_at->toIso8601String()];
    }
}
