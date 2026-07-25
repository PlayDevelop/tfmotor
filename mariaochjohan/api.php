<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$config = require __DIR__ . '/config.php';
$action = isset($_POST['action']) ? (string) $_POST['action'] : '';
$dataFile = __DIR__ . '/data/photos.json';
$uploadDir = __DIR__ . '/uploads';
$thumbnailDir = $uploadDir . '/thumbs';

try {
    ensure_storage($dataFile, $uploadDir, $thumbnailDir);

    if ($action === 'list') {
        respond(['photos' => read_photos($dataFile)]);
    }

    if ($action === 'upload') {
        $guestName = trim_text(isset($_POST['guestName']) ? (string) $_POST['guestName'] : '', 60);
        $storedPhotos = handle_uploads($config, $uploadDir, $thumbnailDir, $guestName);
        if (!$storedPhotos) {
            fail('Välj minst en giltig bild.');
        }
        $photos = public_photos($storedPhotos);

        try {
            prepend_photos($dataFile, $photos);
        } catch (Throwable $error) {
            remove_uploaded_photos($storedPhotos);
            throw $error;
        }

        respond(['ok' => true, 'photos' => $photos]);
    }

    fail('Okänd åtgärd.', 404);
} catch (Throwable $error) {
    error_log('[mariaochjohan] ' . $error->getMessage());
    fail('Tekniskt fel. Försök igen om en stund.', 500);
}

function ensure_storage(string $dataFile, string $uploadDir, string $thumbnailDir): void
{
    foreach ([dirname($dataFile), $uploadDir, $thumbnailDir] as $directory) {
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new RuntimeException('Kunde inte skapa lagringsmapp.');
        }
    }

    if (!file_exists($dataFile) && file_put_contents($dataFile, '[]', LOCK_EX) === false) {
        throw new RuntimeException('Kunde inte skapa bildregistret.');
    }
}

function read_photos(string $dataFile): array
{
    $handle = fopen($dataFile, 'c+');
    if ($handle === false) {
        throw new RuntimeException('Kunde inte öppna bildregistret.');
    }

    try {
        if (!flock($handle, LOCK_SH)) {
            throw new RuntimeException('Kunde inte låsa bildregistret.');
        }
        rewind($handle);
        $photos = decode_photos((string) stream_get_contents($handle));
        flock($handle, LOCK_UN);
        return $photos;
    } finally {
        fclose($handle);
    }
}

function prepend_photos(string $dataFile, array $newPhotos): void
{
    $handle = fopen($dataFile, 'c+');
    if ($handle === false) {
        throw new RuntimeException('Kunde inte öppna bildregistret.');
    }

    try {
        if (!flock($handle, LOCK_EX)) {
            throw new RuntimeException('Kunde inte låsa bildregistret.');
        }

        rewind($handle);
        $existing = decode_photos((string) stream_get_contents($handle));
        $json = json_encode(array_merge($newPhotos, $existing), json_flags());
        if ($json === false) {
            throw new RuntimeException('Kunde inte skapa bildregistret.');
        }

        rewind($handle);
        if (!ftruncate($handle, 0) || fwrite($handle, $json) === false) {
            throw new RuntimeException('Kunde inte spara bildregistret.');
        }
        fflush($handle);
        flock($handle, LOCK_UN);
    } finally {
        fclose($handle);
    }
}

function decode_photos(string $raw): array
{
    $photos = json_decode($raw !== '' ? $raw : '[]', true);
    return is_array($photos) ? $photos : [];
}

function handle_uploads(array $config, string $uploadDir, string $thumbnailDir, string $guestName): array
{
    if (!isset($_FILES['photos'])) {
        return [];
    }

    $files = normalize_files($_FILES['photos']);
    if (count($files) > $config['max_files_per_upload']) {
        fail('Ladda upp högst ' . $config['max_files_per_upload'] . ' bilder åt gången.');
    }

    $photos = [];
    foreach ($files as $file) {
        if ($file['error'] !== UPLOAD_ERR_OK) {
            remove_uploaded_photos($photos);
            fail(upload_error_message((int) $file['error']));
        }
        if ($file['size'] <= 0 || $file['size'] > $config['max_file_size']) {
            remove_uploaded_photos($photos);
            fail('En bild är för stor eller tom.');
        }

        $mime = detect_mime($file['tmp_name'], $file['type']);
        if (!isset($config['allowed_types'][$mime]) || !is_valid_image($file['tmp_name'], $mime)) {
            remove_uploaded_photos($photos);
            fail('En av filerna är inte en giltig bild.');
        }

        $id = generate_id();
        $extension = $config['allowed_types'][$mime];
        $filename = gmdate('Ymd-His') . '-' . $id . '.' . $extension;
        $target = $uploadDir . '/' . $filename;
        if (!move_uploaded_file($file['tmp_name'], $target)) {
            remove_uploaded_photos($photos);
            throw new RuntimeException('Kunde inte spara en uppladdad bild.');
        }
        @chmod($target, 0644);

        $thumbnailFilename = gmdate('Ymd-His') . '-' . $id . '.jpg';
        $thumbnailTarget = $thumbnailDir . '/' . $thumbnailFilename;
        $hasThumbnail = create_thumbnail(
            $target,
            $thumbnailTarget,
            $mime,
            (int) $config['thumbnail_width'],
            (int) $config['thumbnail_quality']
        );

        $photos[] = [
            'id' => $id,
            'url' => 'uploads/' . $filename,
            'thumbnailUrl' => $hasThumbnail ? 'uploads/thumbs/' . $thumbnailFilename : 'uploads/' . $filename,
            'caption' => $guestName !== '' ? 'Uppladdad av ' . $guestName : 'Uppladdad bild',
            'uploadedAt' => gmdate('c'),
            '_file' => $target,
            '_thumbnail' => $hasThumbnail ? $thumbnailTarget : '',
        ];
    }

    return $photos;
}

function public_photos(array $photos): array
{
    foreach ($photos as &$photo) {
        unset($photo['_file'], $photo['_thumbnail']);
    }
    unset($photo);
    return $photos;
}

function normalize_files(array $files): array
{
    if (!is_array($files['name'])) {
        return [$files];
    }

    $normalized = [];
    foreach ($files['name'] as $index => $name) {
        $normalized[] = [
            'name' => $name,
            'type' => $files['type'][$index],
            'tmp_name' => $files['tmp_name'][$index],
            'error' => $files['error'][$index],
            'size' => $files['size'][$index],
        ];
    }
    return $normalized;
}

function detect_mime(string $path, string $fallback): string
{
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo !== false) {
            $mime = finfo_file($finfo, $path);
            finfo_close($finfo);
            if (is_string($mime) && $mime !== '') {
                return $mime;
            }
        }
    }
    return $fallback;
}

function is_valid_image(string $path, string $mime): bool
{
    if (in_array($mime, ['image/heic', 'image/heif'], true)) {
        return true;
    }
    return @getimagesize($path) !== false;
}

function create_thumbnail(
    string $sourcePath,
    string $targetPath,
    string $mime,
    int $maxWidth,
    int $quality
): bool {
    if (!function_exists('imagecreatetruecolor')) {
        return false;
    }

    $source = null;
    if ($mime === 'image/jpeg' && function_exists('imagecreatefromjpeg')) {
        $source = @imagecreatefromjpeg($sourcePath);
    } elseif ($mime === 'image/png' && function_exists('imagecreatefrompng')) {
        $source = @imagecreatefrompng($sourcePath);
    } elseif ($mime === 'image/webp' && function_exists('imagecreatefromwebp')) {
        $source = @imagecreatefromwebp($sourcePath);
    }

    if ($source === false || $source === null) {
        return false;
    }

    $source = orient_jpeg($source, $sourcePath, $mime);
    $sourceWidth = imagesx($source);
    $sourceHeight = imagesy($source);
    if ($sourceWidth < 1 || $sourceHeight < 1) {
        imagedestroy($source);
        return false;
    }

    $targetWidth = min($maxWidth, $sourceWidth);
    $targetHeight = max(1, (int) round($sourceHeight * ($targetWidth / $sourceWidth)));
    $thumbnail = imagecreatetruecolor($targetWidth, $targetHeight);
    $white = imagecolorallocate($thumbnail, 255, 255, 255);
    imagefill($thumbnail, 0, 0, $white);
    imagecopyresampled(
        $thumbnail,
        $source,
        0,
        0,
        0,
        0,
        $targetWidth,
        $targetHeight,
        $sourceWidth,
        $sourceHeight
    );

    $saved = imagejpeg($thumbnail, $targetPath, max(55, min(90, $quality)));
    imagedestroy($thumbnail);
    imagedestroy($source);
    if ($saved) {
        @chmod($targetPath, 0644);
    }
    return $saved;
}

function orient_jpeg($image, string $path, string $mime)
{
    if ($mime !== 'image/jpeg' || !function_exists('exif_read_data')) {
        return $image;
    }

    $exif = @exif_read_data($path);
    $orientation = is_array($exif) && isset($exif['Orientation']) ? (int) $exif['Orientation'] : 1;
    $rotated = $image;
    if ($orientation === 3) {
        $rotated = imagerotate($image, 180, 0);
    } elseif ($orientation === 6) {
        $rotated = imagerotate($image, -90, 0);
    } elseif ($orientation === 8) {
        $rotated = imagerotate($image, 90, 0);
    }

    if ($rotated !== false && $rotated !== $image) {
        imagedestroy($image);
        return $rotated;
    }
    return $image;
}

function remove_uploaded_photos(array $photos): void
{
    foreach ($photos as $photo) {
        foreach (['_file', '_thumbnail'] as $key) {
            if (!empty($photo[$key]) && is_file($photo[$key])) {
                @unlink($photo[$key]);
            }
        }
    }
}

function upload_error_message(int $code): string
{
    if ($code === UPLOAD_ERR_INI_SIZE || $code === UPLOAD_ERR_FORM_SIZE) {
        return 'En bild är större än servern tillåter.';
    }
    if ($code === UPLOAD_ERR_PARTIAL) {
        return 'En bild blev bara delvis uppladdad. Försök igen.';
    }
    return 'En bild kunde inte laddas upp.';
}

function generate_id(): string
{
    return bin2hex(random_bytes(10));
}

function trim_text(string $value, int $maxLength): string
{
    $value = trim($value);
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $maxLength, 'UTF-8');
    }
    return substr($value, 0, $maxLength);
}

function json_flags(): int
{
    return JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
}

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, json_flags());
    exit;
}

function fail(string $message, int $status = 400): void
{
    respond(['error' => $message], $status);
}
