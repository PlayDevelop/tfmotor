<?php

return [
    'db' => [
        'dsn' => 'mysql:host=YOUR_MYSQL_HOST;dbname=YOUR_DATABASE;charset=utf8mb4',
        'user' => 'YOUR_DATABASE_USER',
        'password' => 'YOUR_DATABASE_PASSWORD',
    ],
    'notifications' => [
        'enabled' => true,
        'from' => 'Husbilsbokning <noreply@tfmotor.se>',
        'site_url' => 'https://tfmotor.se/husbil/',
    ],
    'users' => [
        'martin@hallagarde.se' => [
            'username' => 'martin',
            'name' => 'Martin',
            'initials' => 'MF',
            'color' => '#173f35',
            'admin' => true,
            'password_pbkdf2' => [
                'salt' => 'RANDOM_HEX_SALT_HERE',
                'hash' => 'PBKDF2_HASH_HERE',
                'iterations' => 120000,
            ],
        ],
    ],
];
