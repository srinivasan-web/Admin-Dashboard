<?php

return [
    // A real asynchronous queue is required; requests must never send mail inline.
    'queue_connection' => env('EMI_QUEUE_CONNECTION', 'database'),
    'notification_email' => env('EMI_ENQUIRY_NOTIFY_EMAIL'),
];
