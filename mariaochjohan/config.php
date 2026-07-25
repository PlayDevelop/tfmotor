<?php

return [
    'max_file_size' => 16 * 1024 * 1024,
    'max_files_per_upload' => 20,
    'thumbnail_width' => 640,
    'thumbnail_quality' => 80,
    'allowed_types' => [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/heic' => 'heic',
        'image/heif' => 'heif',
    ],
];
