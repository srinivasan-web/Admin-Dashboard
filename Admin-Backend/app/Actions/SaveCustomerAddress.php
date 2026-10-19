<?php

namespace App\Actions;

use App\Models\Customer;
use App\Models\CustomerAddress;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class SaveCustomerAddress
{
    /** @param array<string, mixed> $input */
    public function execute(Customer $customer, array $input, ?string $addressId = null): CustomerAddress
    {
        $data = Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:32'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['required', 'string', 'max:10000'],
            'state' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:255'],
            'postal_code' => ['required', 'regex:/^[0-9]{6}$/'],
        ])->validate();

        return DB::transaction(function () use ($customer, $data, $addressId): CustomerAddress {
            if ($addressId !== null) {
                $address = $customer->addresses()->whereKey($addressId)->lockForUpdate()->firstOrFail();
                $address->fill($data)->save();

                return $address->refresh();
            }

            return $customer->addresses()->create($data);
        });
    }
}
