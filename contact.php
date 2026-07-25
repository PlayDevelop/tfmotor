<?php
declare(strict_types=1);

$configPath = __DIR__ . '/contact-config.php';
$contactConfig = is_file($configPath) ? require $configPath : [];
$recipients = is_array($contactConfig['recipients'] ?? null)
    ? array_values(array_filter($contactConfig['recipients'], 'is_string'))
    : [];

function clean_value(string $value): string
{
    return trim(str_replace(["\r", "\n"], ' ', $value));
}

function render_response(string $title, string $message): void
{
    http_response_code($title === 'Tack!' ? 200 : 400);
    echo '<!doctype html><html lang="sv"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</title><link rel="stylesheet" href="styles.css"></head><body><main class="contact-section" style="min-height:100vh;align-items:center"><div class="contact-copy"><p class="kicker">TF Motor</p><h2>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</h2><p>' . htmlspecialchars($message, ENT_QUOTES, 'UTF-8') . '</p><a class="primary-button" href="/">Till startsidan</a></div></main></body></html>';
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    render_response('Oj', 'Formuläret behöver skickas från kontaktsidan.');
}

if (!$recipients) {
    render_response('Oj', 'Kontaktformuläret är inte konfigurerat ännu.');
}

if (!empty($_POST['website'] ?? '')) {
    render_response('Tack!', 'Ditt meddelande är skickat.');
}

$name = clean_value((string)($_POST['name'] ?? ''));
$email = clean_value((string)($_POST['email'] ?? ''));
$phone = clean_value((string)($_POST['phone'] ?? ''));
$message = trim((string)($_POST['message'] ?? ''));

if ($name === '' || $email === '' || $message === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    render_response('Oj', 'Fyll i namn, giltig e-post och meddelande.');
}

$rawSubject = "[TF Motor kontaktform] Nytt meddelande från {$name}";
$subject = function_exists('mb_encode_mimeheader')
    ? mb_encode_mimeheader($rawSubject, 'UTF-8')
    : '=?UTF-8?B?' . base64_encode($rawSubject) . '?=';

$body = implode("\n", [
    '*** TF MOTOR KONTAKTFORMULÄR ***',
    'Detta meddelande skickades från kontaktformuläret på tfmotor.se.',
    'Svara direkt på mailet för att svara avsändaren.',
    '',
    '--- Avsändare ---',
    "Namn: {$name}",
    "E-post: {$email}",
    "Telefon: {$phone}",
    '',
    '--- Meddelande ---',
    $message,
]);

$headers = [
    'From: TF Motor Kontaktform <noreply@tfmotor.se>',
    'Reply-To: ' . $email,
    'X-TF-Motor-Source: contact-form',
    'Content-Type: text/plain; charset=UTF-8',
];

$sent = mail(implode(',', $recipients), $subject, $body, implode("\r\n", $headers));

if (!$sent) {
    render_response('Oj', 'Meddelandet kunde inte skickas just nu. Testa att maila tommy@tfmotor.se direkt.');
}

render_response('Tack!', 'Ditt meddelande är skickat.');
