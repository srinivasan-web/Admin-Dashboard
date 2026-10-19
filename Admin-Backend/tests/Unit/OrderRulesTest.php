<?php

namespace Tests\Unit;

use App\Domain\Orders\OrderMoney;
use App\Domain\Orders\OrderStateRules;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class OrderRulesTest extends TestCase
{
    public function test_money_is_exact_and_bounded(): void
    {
        foreach (['0' => '0.00', '12.3' => '12.30', '9999999999.99' => '9999999999.99'] as $input => $expected) {
            $this->assertSame($expected, OrderMoney::fromMinorUnits(OrderMoney::toMinorUnits((string) $input, 'Amount')));
        }
        foreach (['-0.01', '1.001', '10000000000', '999999999999999999999999999', '1e2', "1\n"] as $input) {
            try {
                OrderMoney::toMinorUnits($input, 'Amount');
                $this->fail('Invalid money must be rejected.');
            } catch (InvalidArgumentException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function test_valid_transitions_and_terminal_retries(): void
    {
        foreach ([
            ['order', 'pending', 'confirmed'], ['order', 'confirmed', 'processing'],
            ['order', 'processing', 'completed'], ['order', 'cancelled', 'cancelled'],
            ['order', 'hold', 'hold'], ['order', 'hold', 'confirmed', 'confirmed'],
            ['payment', 'pending', 'authorized'], ['payment', 'authorized', 'paid'],
            ['payment', 'paid', 'refunded'], ['payment', 'refunded', 'refunded'],
            ['fulfillment', 'pending', 'processing'], ['fulfillment', 'processing', 'shipped'],
            ['fulfillment', 'shipped', 'delivered'], ['fulfillment', 'delivered', 'delivered'],
        ] as $transition) {
            OrderStateRules::assertTransition(...$transition);
            $this->addToAssertionCount(1);
        }
    }

    public function test_invalid_transitions_do_not_invent_statuses(): void
    {
        foreach ([
            ['order', 'pending', 'shipped'], ['order', 'pending', 'failed'],
            ['order', 'completed', 'returned'], ['order', 'cancelled', 'pending'],
            ['order', 'hold', 'processing', 'confirmed'], ['order', 'hold', 'confirmed'],
            ['payment', 'pending', 'paid'], ['payment', 'paid', 'authorized'],
            ['fulfillment', 'pending', 'delivered'], ['order', null, 'pending'],
        ] as $transition) {
            try {
                OrderStateRules::assertTransition(...$transition);
                $this->fail('Invalid transition must be rejected.');
            } catch (InvalidArgumentException) {
                $this->addToAssertionCount(1);
            }
        }
    }
}
