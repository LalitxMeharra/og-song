<?php
// ============================================================
// SONGBACKEND.PHP - JioSaavn API Proxy (PHP Version)
// ============================================================

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function cleanText($value = '') {
    return trim(strip_tags(html_entity_decode($value ?? '')));
}

function decryptUrl($encryptedUrl) {
    if (!$encryptedUrl) return null;
    
    $key = '38346591';
    $cleaned = preg_replace('/\s+/', '', trim($encryptedUrl));
    $missing = strlen($cleaned) % 4;
    if ($missing) $cleaned .= str_repeat('=', 4 - $missing);
    
    $encrypted = base64_decode($cleaned);
    if (!$encrypted) return null;
    
    // DES-ECB Decryption
    $decrypted = openssl_decrypt(
        $encrypted,
        'DES-ECB',
        $key,
        OPENSSL_RAW_DATA | OPENSSL_ZERO_PADDING
    );
    
    if (!$decrypted) return null;
    
    // Remove PKCS7 padding
    $padLen = ord(substr($decrypted, -1));
    if ($padLen > 0 && $padLen <= 8) {
        $decrypted = substr($decrypted, 0, -$padLen);
    }
    
    $finalUrl = trim($decrypted);
    return strpos($finalUrl, 'http') === 0 ? $finalUrl : null;
}

function fetchJson($url) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36');
    curl_setopt($ch, CURLOPT_REFERER, 'https://www.jiosaavn.com/');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    $response = curl_exec($ch);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) throw new Exception("cURL error: " . $error);
    return json_decode($response, true);
}

function getPid($item) {
    // Try multiple sources for PID
    if (!empty($item['id'])) return $item['id'];
    if (!empty($item['more_info']['song_pids'])) {
        return explode(',', $item['more_info']['song_pids'])[0];
    }
    if (!empty($item['song_pids'])) {
        return explode(',', $item['song_pids'])[0];
    }
    // Try to find any ID field
    foreach ($item as $key => $value) {
        if (stripos($key, 'id') !== false || stripos($key, 'pid') !== false) {
            if (!empty($value) && is_string($value)) {
                return explode(',', $value)[0];
            }
        }
    }
    return null;
}

function mapSearchItem($item, $pid) {
    return [
        'id' => $pid,
        'pid' => $pid,
        'title' => cleanText($item['title'] ?? $item['song'] ?? 'Unknown'),
        'artist' => cleanText(
            $item['more_info']['primary_artists'] ?? 
            $item['primary_artists'] ?? 
            $item['artist'] ?? 
            'Unknown'
        ),
        'album' => cleanText($item['album'] ?? $item['more_info']['album'] ?? 'Single'),
        'image' => str_replace(['50x50', '150x150', '100x100'], '500x500', 
            $item['image'] ?? $item['more_info']['image'] ?? ''
        ),
        'duration' => (int)($item['duration'] ?? $item['more_info']['duration'] ?? 0)
    ];
}

// ============================================================
// ROUTE HANDLING
// ============================================================

$action = $_GET['action'] ?? '';
$q = $_GET['q'] ?? $_GET['query'] ?? '';
$pid = $_GET['pid'] ?? $_GET['id'] ?? '';
$downloadUrl = $_GET['url'] ?? '';
$filename = $_GET['filename'] ?? '';
$quality = $_GET['quality'] ?? '320kbps';

try {
    // ============================================================
    // ROUTE 1: DOWNLOAD
    // ============================================================
    if ($action === 'download' && $downloadUrl) {
        $cdnUrl = urldecode($downloadUrl);
        if (!filter_var($cdnUrl, FILTER_VALIDATE_URL)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid url']);
            exit;
        }

        $safeName = preg_replace('/[^\w\s.-]/', '', $filename ?: 'song');
        $safeName = trim($safeName) ?: 'song';
        $finalName = $safeName . '_' . $quality . '.mp4';

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $cdnUrl);
        curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36');
        curl_setopt($ch, CURLOPT_REFERER, 'https://www.jiosaavn.com/');
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
        curl_setopt($ch, CURLOPT_BINARYTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . addslashes($finalName) . '"');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        
        curl_exec($ch);
        curl_close($ch);
        exit;
    }

    // ============================================================
    // ROUTE 2: SONG DETAILS
    // ============================================================
    if ($action === 'details' && $pid) {
        $targetPid = explode(',', $pid)[0];
        
        $url = "https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0&_format=json&pids=" . urlencode($targetPid);
        $data = fetchJson($url);
        
        $songData = $data[$targetPid] ?? null;
        if (!$songData) {
            // Try to find the first song
            foreach ($data as $key => $val) {
                if (is_array($val) && isset($val['song'])) {
                    $songData = $val;
                    break;
                }
            }
        }
        
        if (!$songData) {
            http_response_code(404);
            echo json_encode(['error' => 'Song details not found']);
            exit;
        }
        
        $encryptedUrl = $songData['encrypted_media_url'] ?? $songData['more_info']['encrypted_media_url'] ?? '';
        $decryptedUrl = decryptUrl($encryptedUrl);
        
        if (!$decryptedUrl) {
            http_response_code(500);
            echo json_encode(['error' => 'Decryption failed']);
            exit;
        }
        
        $basePrefix = substr($decryptedUrl, 0, strrpos($decryptedUrl, '_'));
        $ext = strpos($decryptedUrl, '.mp3') !== false ? 'mp3' : 'mp4';
        
        echo json_encode([
            'success' => true,
            'id' => $targetPid,
            'title' => cleanText($songData['song'] ?? $songData['title'] ?? ''),
            'artist' => cleanText($songData['primary_artists'] ?? $songData['more_info']['primary_artists'] ?? ''),
            'album' => cleanText($songData['album'] ?? $songData['more_info']['album'] ?? ''),
            'image' => str_replace(['50x50', '150x150'], '500x500', 
                $songData['image'] ?? $songData['more_info']['image'] ?? ''
            ),
            'duration' => (string)($songData['duration'] ?? $songData['more_info']['duration'] ?? '0'),
            'links' => [
                '320' => $basePrefix . '_320.' . $ext,
                '160' => $basePrefix . '_160.' . $ext,
                '96' => $basePrefix . '_96.' . $ext
            ]
        ]);
        exit;
    }

    // ============================================================
    // ROUTE 3: SEARCH - FIXED (First result included)
    // ============================================================
    if ($action === 'search' && $q) {
        $results = [];
        
        // Primary: Autocomplete API
        $url1 = "https://www.jiosaavn.com/api.php?__call=autocomplete.get&_format=json&_marker=0&cc=in&includeMetaTags=1&query=" . urlencode($q);
        $data1 = fetchJson($url1);
        
        if (!empty($data1['songs']['data'])) {
            foreach ($data1['songs']['data'] as $item) {
                $pid = getPid($item);
                if ($pid) {
                    $results[] = mapSearchItem($item, $pid);
                }
            }
        }
        
        // 🔥 FIX: If autocomplete returns less than 3 results, use search API
        if (count($results) < 3) {
            $url2 = "https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&query=" . urlencode($q);
            $data2 = fetchJson($url2);
            
            if (!empty($data2['results'])) {
                foreach ($data2['results'] as $item) {
                    $pid = $item['id'] ?? '';
                    if ($pid && !in_array($pid, array_column($results, 'id'))) {
                        $results[] = [
                            'id' => $pid,
                            'pid' => $pid,
                            'title' => cleanText($item['title'] ?? 'Unknown'),
                            'artist' => cleanText($item['primary_artists'] ?? 'Unknown'),
                            'album' => cleanText($item['album'] ?? 'Single'),
                            'image' => str_replace(['50x50', '150x150'], '500x500', $item['image'] ?? ''),
                            'duration' => (int)($item['duration'] ?? 0)
                        ];
                    }
                }
            }
        }
        
        echo json_encode([
            'query' => $q,
            'results' => $results
        ]);
        exit;
    }

    // ============================================================
    // FALLBACK
    // ============================================================
    http_response_code(400);
    echo json_encode(['error' => 'Missing action or parameters']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
