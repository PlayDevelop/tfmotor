<?php

session_start();
header('Content-Type: application/json; charset=utf-8');

$config = require __DIR__ . '/config.php';
$usersByEmail = normalize_users(array_get($config, 'users', array()));
$usersByUsername = users_by_username($usersByEmail);
$requestBody = read_request_body();
$action = (string)(isset($_GET['action']) ? $_GET['action'] : array_get($requestBody, 'action', ''));
$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
$operation = strtoupper((string)array_get($requestBody, 'method', $method));
$payload = isset($requestBody['payload']) && is_array($requestBody['payload']) ? $requestBody['payload'] : $requestBody;
$requestId = clean_id((string)(isset($_GET['id']) ? $_GET['id'] : array_get($requestBody, 'id', '')));

try {
    if ($action === 'session') {
        respond(array(
            'user' => public_user(current_user($usersByUsername)),
            'users' => public_users($usersByEmail),
        ));
    }

    if ($action === 'login' && $operation === 'POST') {
        $email = strtolower(trim((string)array_get($payload, 'email', '')));
        $password = (string)array_get($payload, 'password', '');
        $user = array_get($usersByEmail, $email, null);

        if (!$user || !verify_password($password, $user)) {
            fail('Fel användare eller lösenord.', 401);
        }

        session_regenerate_id(true);
        $_SESSION['husbil_user'] = $user['username'];

        respond(array(
            'user' => public_user($user),
            'users' => public_users($usersByEmail),
        ));
    }

    if ($action === 'logout' && $operation === 'POST') {
        $_SESSION = array();
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
        respond(array('ok' => true));
    }

    if ($action === 'bookings') {
        $currentUser = require_user($usersByUsername);
        $pdo = database($config);

        if ($operation === 'GET' || $operation === 'LIST') {
            respond(array('bookings' => fetch_bookings($pdo)));
        }

        if ($operation === 'POST') {
            $booking = sanitize_booking($payload, $currentUser, $usersByUsername, null);
            $booking['id'] = clean_id(array_get($booking, 'id', ''));
            if ($booking['id'] === '') {
                $booking['id'] = generate_id();
            }
            $booking['createdAt'] = gmdate('c');
            $booking['updatedAt'] = $booking['createdAt'];
            reject_conflict($pdo, $booking, null);
            insert_booking($pdo, $booking);
            notify_booking_change($config, $usersByEmail, $usersByUsername, $currentUser, 'created', $booking, null);
            respond(array('booking' => $booking, 'bookings' => fetch_bookings($pdo)), 201);
        }

        if ($operation === 'PUT' || $operation === 'PATCH') {
            $id = $requestId;
            if ($id === '') {
                fail('Boknings-id saknas.');
            }

            $existing = find_booking($pdo, $id);
            if (!$existing) {
                fail('Bokningen finns inte.', 404);
            }
            if (!can_manage($currentUser, $existing)) {
                fail('Du kan bara ändra dina egna bokningar.', 403);
            }

            $booking = sanitize_booking($payload, $currentUser, $usersByUsername, $existing);
            $booking['id'] = $id;
            $booking['createdAt'] = $existing['createdAt'];
            $booking['updatedAt'] = gmdate('c');
            reject_conflict($pdo, $booking, $id);
            update_booking($pdo, $booking);
            notify_booking_change($config, $usersByEmail, $usersByUsername, $currentUser, 'updated', $booking, $existing);
            respond(array('booking' => $booking, 'bookings' => fetch_bookings($pdo)));
        }

        if ($operation === 'DELETE') {
            $id = $requestId;
            if ($id === '') {
                fail('Boknings-id saknas.');
            }

            $existing = find_booking($pdo, $id);
            if (!$existing) {
                fail('Bokningen finns inte.', 404);
            }
            if (!can_manage($currentUser, $existing)) {
                fail('Du kan bara ta bort dina egna bokningar.', 403);
            }

            delete_booking($pdo, $id);
            notify_booking_change($config, $usersByEmail, $usersByUsername, $currentUser, 'deleted', $existing, null);
            respond(array('ok' => true, 'bookings' => fetch_bookings($pdo)));
        }
    }

    fail('Okänd åtgärd.', 404);
} catch (Exception $error) {
    error_log('[husbil] ' . $error->getMessage());
    fail('Tekniskt fel. Försök igen om en stund.', 500);
}

function array_get($array, $key, $default)
{
    return is_array($array) && array_key_exists($key, $array) ? $array[$key] : $default;
}

function normalize_users($users)
{
    $normalized = array();
    foreach ($users as $email => $user) {
        $email = strtolower(trim((string)$email));
        $user['email'] = $email;
        $user['username'] = strtolower(trim((string)$user['username']));
        $user['admin'] = !empty($user['admin']);
        $normalized[$email] = $user;
    }
    return $normalized;
}

function users_by_username($usersByEmail)
{
    $users = array();
    foreach ($usersByEmail as $user) {
        $users[$user['username']] = $user;
    }
    return $users;
}

function public_users($usersByEmail)
{
    $users = array();
    foreach ($usersByEmail as $user) {
        $users[] = public_user($user);
    }
    return $users;
}

function public_user($user)
{
    if (!$user) {
        return null;
    }

    return array(
        'username' => $user['username'],
        'name' => $user['name'],
        'initials' => $user['initials'],
        'color' => $user['color'],
        'admin' => !empty($user['admin']),
    );
}

function verify_password($password, $user)
{
    if (isset($user['password_hash']) && function_exists('password_verify') && password_verify($password, (string)$user['password_hash'])) {
        return true;
    }

    if (isset($user['password_pbkdf2']) && is_array($user['password_pbkdf2'])) {
        $settings = $user['password_pbkdf2'];
        $iterations = (int)array_get($settings, 'iterations', 120000);
        $salt = (string)array_get($settings, 'salt', '');
        $expected = (string)array_get($settings, 'hash', '');
        $actual = pbkdf2_sha256($password, $salt, $iterations, 64);
        return safe_equals($expected, $actual);
    }

    if (isset($user['password_sha256'])) {
        return safe_equals((string)$user['password_sha256'], hash('sha256', $password));
    }

    return false;
}

function pbkdf2_sha256($password, $salt, $iterations, $length)
{
    if (function_exists('hash_pbkdf2')) {
        return hash_pbkdf2('sha256', $password, $salt, $iterations, $length);
    }

    $rawLength = (int)ceil($length / 2);
    $hashLength = 32;
    $blockCount = (int)ceil($rawLength / $hashLength);
    $output = '';

    for ($i = 1; $i <= $blockCount; $i++) {
        $last = $salt . pack('N', $i);
        $last = hash_hmac('sha256', $last, $password, true);
        $xorsum = $last;
        for ($j = 1; $j < $iterations; $j++) {
            $last = hash_hmac('sha256', $last, $password, true);
            $xorsum = $xorsum ^ $last;
        }
        $output .= $xorsum;
    }

    return substr(bin2hex($output), 0, $length);
}

function safe_equals($expected, $actual)
{
    if (function_exists('hash_equals')) {
        return hash_equals($expected, $actual);
    }
    if (strlen($expected) !== strlen($actual)) {
        return false;
    }
    $result = 0;
    for ($i = 0; $i < strlen($expected); $i++) {
        $result |= ord($expected[$i]) ^ ord($actual[$i]);
    }
    return $result === 0;
}

function current_user($usersByUsername)
{
    $username = isset($_SESSION['husbil_user']) ? $_SESSION['husbil_user'] : '';
    return array_get($usersByUsername, $username, null);
}

function require_user($usersByUsername)
{
    $user = current_user($usersByUsername);
    if (!$user) {
        fail('Du behöver logga in.', 401);
    }
    return $user;
}

function database($config)
{
    $db = array_get($config, 'db', array());
    $dsn = (string)array_get($db, 'dsn', 'sqlite:' . __DIR__ . '/data/husbil.sqlite');

    if (strpos($dsn, 'sqlite:') === 0) {
        $path = substr($dsn, 7);
        if ($path !== ':memory:') {
            $dir = dirname($path);
            if (!is_dir($dir)) {
                mkdir($dir, 0775, true);
            }
        }
    }

    $pdo = new PDO(
        $dsn,
        array_get($db, 'user', null),
        array_get($db, 'password', null),
        array(
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        )
    );
    ensure_database($pdo, $dsn);
    return $pdo;
}

function ensure_database($pdo, $dsn)
{
    if (strpos($dsn, 'mysql:') === 0) {
        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS bookings (
                id VARCHAR(64) PRIMARY KEY,
                title VARCHAR(120) NOT NULL,
                start_date DATE NOT NULL,
                start_time VARCHAR(5) NOT NULL,
                end_date DATE NOT NULL,
                end_time VARCHAR(5) NOT NULL,
                owner VARCHAR(60) NOT NULL,
                destination VARCHAR(120) NOT NULL DEFAULT '',
                notes TEXT NOT NULL,
                created_at VARCHAR(40) NOT NULL,
                updated_at VARCHAR(40) NOT NULL
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        );
        return;
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS bookings (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            start_date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_date TEXT NOT NULL,
            end_time TEXT NOT NULL,
            owner TEXT NOT NULL,
            destination TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )"
    );
}

function fetch_bookings($pdo)
{
    $statement = $pdo->query(
        'SELECT id, title, start_date, start_time, end_date, end_time, owner, destination, notes, created_at, updated_at
         FROM bookings
         ORDER BY start_date ASC, start_time ASC'
    );
    $rows = $statement->fetchAll();
    $bookings = array();
    foreach ($rows as $row) {
        $bookings[] = public_booking($row);
    }
    return $bookings;
}

function find_booking($pdo, $id)
{
    $statement = $pdo->prepare(
        'SELECT id, title, start_date, start_time, end_date, end_time, owner, destination, notes, created_at, updated_at
         FROM bookings
         WHERE id = :id'
    );
    $statement->execute(array('id' => $id));
    $row = $statement->fetch();
    return $row ? public_booking($row) : null;
}

function insert_booking($pdo, $booking)
{
    $statement = $pdo->prepare(
        'INSERT INTO bookings (id, title, start_date, start_time, end_date, end_time, owner, destination, notes, created_at, updated_at)
         VALUES (:id, :title, :start_date, :start_time, :end_date, :end_time, :owner, :destination, :notes, :created_at, :updated_at)'
    );
    $statement->execute(db_booking($booking));
}

function update_booking($pdo, $booking)
{
    $statement = $pdo->prepare(
        'UPDATE bookings
         SET title = :title,
             start_date = :start_date,
             start_time = :start_time,
             end_date = :end_date,
             end_time = :end_time,
             owner = :owner,
             destination = :destination,
             notes = :notes,
             created_at = :created_at,
             updated_at = :updated_at
         WHERE id = :id'
    );
    $statement->execute(db_booking($booking));
}

function delete_booking($pdo, $id)
{
    $statement = $pdo->prepare('DELETE FROM bookings WHERE id = :id');
    $statement->execute(array('id' => $id));
}

function sanitize_booking($payload, $currentUser, $usersByUsername, $existing)
{
    $existingOwner = $existing ? array_get($existing, 'owner', $currentUser['username']) : $currentUser['username'];
    $owner = strtolower(trim((string)array_get($payload, 'owner', $existingOwner)));
    if (empty($currentUser['admin'])) {
        $owner = $currentUser['username'];
    }
    if (!isset($usersByUsername[$owner])) {
        fail('Välj en giltig användare.');
    }

    $booking = array(
        'id' => clean_id((string)array_get($payload, 'id', $existing ? array_get($existing, 'id', '') : '')),
        'title' => trim_text((string)array_get($payload, 'title', $existing ? array_get($existing, 'title', 'Husbilen bokad') : 'Husbilen bokad'), 64),
        'startDate' => (string)array_get($payload, 'startDate', $existing ? array_get($existing, 'startDate', '') : ''),
        'startTime' => (string)array_get($payload, 'startTime', $existing ? array_get($existing, 'startTime', '') : ''),
        'endDate' => (string)array_get($payload, 'endDate', $existing ? array_get($existing, 'endDate', '') : ''),
        'endTime' => (string)array_get($payload, 'endTime', $existing ? array_get($existing, 'endTime', '') : ''),
        'owner' => $owner,
        'destination' => trim_text((string)array_get($payload, 'destination', $existing ? array_get($existing, 'destination', '') : ''), 70),
        'notes' => trim_text((string)array_get($payload, 'notes', $existing ? array_get($existing, 'notes', '') : ''), 240),
    );
    if ($booking['title'] === '') {
        $booking['title'] = 'Husbilen bokad';
    }

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $booking['startDate']) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $booking['endDate'])) {
        fail('Fyll i start och slut.');
    }
    if (!preg_match('/^\d{2}:\d{2}$/', $booking['startTime']) || !preg_match('/^\d{2}:\d{2}$/', $booking['endTime'])) {
        fail('Fyll i start och slut.');
    }
    if (booking_timestamp($booking, 'start') >= booking_timestamp($booking, 'end')) {
        fail('Sluttiden behöver vara efter starttiden.');
    }

    return $booking;
}

function reject_conflict($pdo, $candidate, $ignoreId)
{
    foreach (fetch_bookings($pdo) as $booking) {
        if ($ignoreId && $booking['id'] === $ignoreId) {
            continue;
        }
        if (booking_timestamp($candidate, 'start') < booking_timestamp($booking, 'end') && booking_timestamp($candidate, 'end') > booking_timestamp($booking, 'start')) {
            fail('Bokningen krockar med en annan bokning.', 409);
        }
    }
}

function can_manage($user, $booking)
{
    return !empty($user['admin']) || $booking['owner'] === $user['username'];
}

function notify_booking_change($config, $usersByEmail, $usersByUsername, $actor, $event, $booking, $previousBooking)
{
    try {
        send_booking_notification($config, $usersByEmail, $usersByUsername, $actor, $event, $booking, $previousBooking);
    } catch (Exception $error) {
        error_log('[husbil] Notifiering misslyckades: ' . $error->getMessage());
    }
}

function send_booking_notification($config, $usersByEmail, $usersByUsername, $actor, $event, $booking, $previousBooking)
{
    $notifications = array_get($config, 'notifications', array());
    if (isset($notifications['enabled']) && !$notifications['enabled']) {
        return;
    }
    if (!function_exists('mail')) {
        error_log('[husbil] mail() saknas, notifiering skickades inte.');
        return;
    }

    $recipients = array();
    foreach ($usersByEmail as $email => $user) {
        if (array_get($actor, 'email', '') !== $email) {
            $recipients[] = $email;
        }
    }
    if (!$recipients) {
        return;
    }

    $eventLabels = array(
        'created' => 'Ny bokning',
        'updated' => 'Bokning ändrad',
        'deleted' => 'Bokning borttagen',
    );
    $eventLabel = array_get($eventLabels, $event, 'Bokning uppdaterad');
    $owner = array_get($usersByUsername, $booking['owner'], null);
    $siteUrl = (string)array_get($notifications, 'site_url', 'https://tfmotor.se/husbil/');
    $from = clean_mail_header((string)array_get($notifications, 'from', 'Husbilsbokning <noreply@tfmotor.se>'));
    $subject = clean_mail_header('[Husbilen] ' . $eventLabel . ': ' . $booking['title']);

    $lines = array(
        'Det här mailet kommer från husbilsbokningens kalender.',
        '',
        'Händelse: ' . $eventLabel,
        'Ändrat av: ' . array_get($actor, 'name', array_get($actor, 'username', 'Okänd')),
        'Bokad för: ' . ($owner ? array_get($owner, 'name', $booking['owner']) : $booking['owner']),
        'Rubrik: ' . $booking['title'],
        'Tid: ' . booking_range_text($booking),
    );

    if ($booking['destination'] !== '') {
        $lines[] = 'Destination: ' . $booking['destination'];
    }
    if ($booking['notes'] !== '') {
        $lines[] = 'Notering: ' . $booking['notes'];
    }
    if ($previousBooking) {
        $lines[] = '';
        $lines[] = 'Före ändringen:';
        $lines[] = 'Rubrik: ' . $previousBooking['title'];
        $lines[] = 'Tid: ' . booking_range_text($previousBooking);
        $previousOwner = array_get($usersByUsername, $previousBooking['owner'], null);
        $lines[] = 'Bokad för: ' . ($previousOwner ? array_get($previousOwner, 'name', $previousBooking['owner']) : $previousBooking['owner']);
    }

    $lines[] = '';
    $lines[] = 'Öppna kalendern: ' . $siteUrl;

    $body = implode("\n", $lines);
    $headers = implode("\r\n", array(
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: ' . $from,
        'X-TF-Motor-Source: husbil-booking',
    ));

    foreach ($recipients as $recipient) {
        $ok = @mail($recipient, encode_mail_subject($subject), $body, $headers);
        if (!$ok) {
            error_log('[husbil] Kunde inte skicka bokningsmail till ' . $recipient);
        }
    }
}

function booking_range_text($booking)
{
    return $booking['startDate'] . ' ' . $booking['startTime'] . ' - ' . $booking['endDate'] . ' ' . $booking['endTime'];
}

function clean_mail_header($value)
{
    return str_replace(array("\r", "\n"), '', $value);
}

function encode_mail_subject($subject)
{
    if (function_exists('mb_encode_mimeheader')) {
        return mb_encode_mimeheader($subject, 'UTF-8', 'B', "\r\n");
    }
    return '=?UTF-8?B?' . base64_encode($subject) . '?=';
}

function public_booking($row)
{
    return array(
        'id' => $row['id'],
        'title' => $row['title'],
        'startDate' => $row['start_date'],
        'startTime' => substr($row['start_time'], 0, 5),
        'endDate' => $row['end_date'],
        'endTime' => substr($row['end_time'], 0, 5),
        'owner' => $row['owner'],
        'destination' => array_get($row, 'destination', ''),
        'notes' => array_get($row, 'notes', ''),
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'],
    );
}

function db_booking($booking)
{
    return array(
        'id' => $booking['id'],
        'title' => $booking['title'],
        'start_date' => $booking['startDate'],
        'start_time' => $booking['startTime'],
        'end_date' => $booking['endDate'],
        'end_time' => $booking['endTime'],
        'owner' => $booking['owner'],
        'destination' => $booking['destination'],
        'notes' => $booking['notes'],
        'created_at' => $booking['createdAt'],
        'updated_at' => $booking['updatedAt'],
    );
}

function booking_timestamp($booking, $edge)
{
    $date = $edge === 'start' ? $booking['startDate'] : $booking['endDate'];
    $time = $edge === 'start' ? $booking['startTime'] : $booking['endTime'];
    $timestamp = strtotime($date . ' ' . $time);
    if ($timestamp === false) {
        fail('Ogiltig tid.');
    }
    return $timestamp;
}

function read_request_body()
{
    if ($_POST) {
        return $_POST;
    }

    $raw = file_get_contents('php://input');
    if (!$raw) {
        return array();
    }

    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
        fail('Ogiltig JSON.');
    }
    return $payload;
}

function clean_id($id)
{
    $clean = preg_replace('/[^a-zA-Z0-9_-]/', '', $id);
    return $clean ? $clean : '';
}

function generate_id()
{
    if (function_exists('random_bytes')) {
        return bin2hex(random_bytes(16));
    }
    if (function_exists('openssl_random_pseudo_bytes')) {
        return bin2hex(openssl_random_pseudo_bytes(16));
    }
    return clean_id(uniqid('', true));
}

function trim_text($value, $maxLength)
{
    $value = trim($value);
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $maxLength, 'UTF-8');
    }
    return substr($value, 0, $maxLength);
}

function respond($payload, $status = 200)
{
    http_response_code($status);
    $flags = 0;
    if (defined('JSON_UNESCAPED_UNICODE')) {
        $flags |= JSON_UNESCAPED_UNICODE;
    }
    if (defined('JSON_UNESCAPED_SLASHES')) {
        $flags |= JSON_UNESCAPED_SLASHES;
    }
    echo json_encode($payload, $flags);
    exit;
}

function fail($message, $status = 400)
{
    respond(array('error' => $message), $status);
}
