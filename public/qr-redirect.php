<?php

declare(strict_types=1);

function render_page(int $statusCode, string $title, string $message): void
{
    http_response_code($statusCode);
    $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    $safeMessage = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');

    echo '<!doctype html><html lang="en"><head><meta charset="utf-8">';
    echo '<meta name="viewport" content="width=device-width, initial-scale=1">';
    echo '<title>' . $safeTitle . ' | Adpadz</title>';
    echo '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0d0f0c;color:#fff;font-family:Arial,sans-serif;padding:24px}.card{max-width:520px;border:1px solid rgba(142,219,57,.35);background:#171a15;border-radius:18px;padding:28px;box-shadow:0 20px 70px rgba(0,0,0,.35)}.mark{width:42px;height:42px;border-radius:12px;background:#8edb39;color:#050505;display:flex;align-items:center;justify-content:center;font-weight:900;margin-bottom:18px}h1{margin:0 0 10px;font-size:24px}p{margin:0;color:#cfd7c8;line-height:1.5}</style>';
    echo '</head><body><main class="card"><div class="mark">A</div><h1>' . $safeTitle . '</h1><p>' . $safeMessage . '</p></main></body></html>';
    exit;
}

$configPath = __DIR__ . '/qr-config.php';

if (!is_file($configPath)) {
    error_log('Adpadz QR redirect is missing qr-config.php.');
    render_page(500, 'QR service unavailable', 'This QR service has not been configured yet.');
}

$config = require $configPath;
$supabaseUrl = rtrim((string)($config['supabase_url'] ?? ''), '/');
$supabaseAnonKey = (string)($config['supabase_anon_key'] ?? '');

if ($supabaseUrl === '' || $supabaseAnonKey === '') {
    error_log('Adpadz QR redirect configuration is incomplete.');
    render_page(500, 'QR service unavailable', 'This QR service has not been configured yet.');
}

$slug = (string)($_GET['slug'] ?? '');

if (!preg_match('/^[A-Za-z0-9_-]+$/', $slug)) {
    render_page(404, 'QR link not found', 'This Adpadz QR link does not exist.');
}

$payload = json_encode([
    'p_slug' => $slug,
    'p_user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
    'p_referrer' => $_SERVER['HTTP_REFERER'] ?? null,
]);

if ($payload === false) {
    render_page(500, 'Could not open QR link', 'The redirect request could not be prepared.');
}

if (!function_exists('curl_init')) {
    error_log('Adpadz QR redirect requires the PHP cURL extension.');
    render_page(500, 'QR service unavailable', 'This server is missing a required QR redirect component.');
}

$ch = curl_init($supabaseUrl . '/rest/v1/rpc/resolve_qr_redirect');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'apikey: ' . $supabaseAnonKey,
        'Authorization: Bearer ' . $supabaseAnonKey,
        'Content-Type: application/json',
        'Accept: application/json',
    ],
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_TIMEOUT => 8,
]);

$response = curl_exec($ch);
$curlError = curl_error($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false || $httpCode < 200 || $httpCode >= 300) {
    error_log('Adpadz QR resolver failed with HTTP ' . $httpCode . ($curlError !== '' ? ': ' . $curlError : ''));
    render_page(502, 'Could not open QR link', 'The QR redirect service is temporarily unavailable.');
}

$result = json_decode($response, true);

if (!is_array($result)) {
    render_page(502, 'Could not open QR link', 'The QR redirect service returned an invalid response.');
}

$status = (string)($result['status'] ?? 'error');

if (($result['ok'] ?? false) === true && isset($result['destination_url']) && is_string($result['destination_url'])) {
    $destinationUrl = trim($result['destination_url']);
    $destinationScheme = strtolower((string)parse_url($destinationUrl, PHP_URL_SCHEME));

    if (
        preg_match('/[\r\n]/', $destinationUrl) === 1
        || filter_var($destinationUrl, FILTER_VALIDATE_URL) === false
        || !in_array($destinationScheme, ['http', 'https'], true)
    ) {
        error_log('Adpadz QR resolver returned an invalid destination URL.');
        render_page(502, 'Could not open QR link', 'The saved QR destination is invalid.');
    }

    header('Cache-Control: no-store, max-age=0');
    header('Location: ' . $destinationUrl, true, 302);
    exit;
}

if ($status === 'not_found') {
    render_page(404, 'QR link not found', 'This Adpadz QR link does not exist or has not been published yet.');
}

if ($status === 'inactive' || $status === 'expired') {
    render_page(410, 'QR link inactive', 'This Adpadz QR link has been paused, archived, or expired.');
}

render_page(500, 'Could not open QR link', 'Something went wrong while loading this Adpadz QR destination.');
