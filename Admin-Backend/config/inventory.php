<?php

return [
    // Applied once when a reservation is created; changing this does not extend existing holds.
    'reservation_ttl_minutes' => (int) env('INVENTORY_RESERVATION_TTL_MINUTES', 30),
];
