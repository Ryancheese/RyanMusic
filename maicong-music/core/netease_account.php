<?php
/**
 * 网易云账号级同步：本机 Cookie + 扫码 / Cookie 登录 + 歌单拉取
 * 扫码 key/check 优先 eapi + type=3（与 NeteaseCloudMusicApiEnhanced 一致）；
 * weapi type=1 在手机确认后常永久卡 802。其它接口优先 /api/，失败再 linux/forward。
 * 由 music.php require；凭证仅存本机 cache。
 */

if (!defined('MC_CORE')) {
    exit;
}

function mc_netease_auth_file()
{
    return mc_qq_cache_dir('netease_auth') . '/session.json';
}

function mc_netease_auth_read()
{
    $file = mc_netease_auth_file();
    if (!is_file($file)) {
        return null;
    }
    $raw = @file_get_contents($file);
    if ($raw === false || $raw === '') {
        return null;
    }
    $data = json_decode($raw, true);
    if (!is_array($data) || empty($data['cookie'])) {
        return null;
    }
    return $data;
}

function mc_netease_auth_write(array $data)
{
    $data['updatedAt'] = time();
    $file = mc_netease_auth_file();
    @file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
}

function mc_netease_auth_clear()
{
    $file = mc_netease_auth_file();
    if (is_file($file)) {
        @unlink($file);
    }
}

function mc_netease_cookie_csrf($cookie)
{
    if (preg_match('/(?:^|;\s*)__csrf=([^;]+)/', $cookie, $m)) {
        return trim($m[1]);
    }
    return '';
}

function mc_netease_normalize_cookie($cookie)
{
    $cookie = trim(str_replace(["\r", "\n"], '', (string) $cookie));
    if ($cookie === '') {
        return '';
    }
    if (stripos($cookie, 'cookie:') === 0) {
        $cookie = trim(substr($cookie, 7));
    }
    return $cookie;
}

function mc_netease_merge_cookies($existing, $incoming)
{
    $map = [];
    foreach ([$existing, $incoming] as $chunk) {
        $chunk = trim((string) $chunk);
        if ($chunk === '') {
            continue;
        }
        foreach (explode(';', $chunk) as $part) {
            $part = trim($part);
            if ($part === '' || strpos($part, '=') === false) {
                continue;
            }
            [$k, $v] = explode('=', $part, 2);
            $k = trim($k);
            if ($k === '') {
                continue;
            }
            $map[$k] = $k . '=' . trim($v);
        }
    }
    return implode('; ', array_values($map));
}

/**
 * 底层 HTTP（可收集 Set-Cookie）
 * @return array{ok:bool,body:?string,json:?array,cookies:string,http:int,error:string}
 */
function mc_netease_http($method, $url, $body = null, $cookie = '', $form = true)
{
    $headers = [
        'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer: https://music.163.com/',
        'Origin: https://music.163.com',
    ];
    if ($cookie !== '') {
        $headers[] = 'Cookie: ' . $cookie;
    }
    if ($method === 'POST' && $form) {
        $headers[] = 'Content-Type: application/x-www-form-urlencoded';
    }

    $setCookies = [];
    $ch = curl_init($url);
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_CUSTOMREQUEST  => strtoupper($method),
        CURLOPT_HEADERFUNCTION => function ($ch, $header) use (&$setCookies) {
            $len = strlen($header);
            if (stripos($header, 'Set-Cookie:') === 0) {
                $line = trim(substr($header, 11));
                $pair = explode(';', $line, 2)[0];
                if (strpos($pair, '=') !== false) {
                    $setCookies[] = trim($pair);
                }
            }
            return $len;
        },
    ];
    if (defined('CURLOPT_PROXY')) {
        $opts[CURLOPT_PROXY] = '';
    }
    if ($method === 'POST') {
        $opts[CURLOPT_POST] = true;
        $opts[CURLOPT_POSTFIELDS] = is_array($body) ? http_build_query($body) : (string) $body;
    }
    curl_setopt_array($ch, $opts);
    $raw = curl_exec($ch);
    $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        return ['ok' => false, 'body' => null, 'json' => null, 'cookies' => '', 'http' => $http, 'error' => $err ?: '请求失败'];
    }

    $cookieStr = '';
    if ($setCookies) {
        $map = [];
        foreach ($setCookies as $pair) {
            [$k, $v] = array_pad(explode('=', $pair, 2), 2, '');
            $map[$k] = $k . '=' . $v;
        }
        $cookieStr = implode('; ', array_values($map));
    }

    $json = json_decode($raw, true);
    return [
        'ok'      => $http >= 200 && $http < 400 && $raw !== '',
        'body'    => $raw,
        'json'    => is_array($json) ? $json : null,
        'cookies' => $cookieStr,
        'http'    => $http,
        'error'   => '',
    ];
}

/**
 * linux/forward（项目已有 encode_netease_data）
 */
function mc_netease_linux_forward($apiPath, array $params, $cookie = '', $method = 'POST')
{
    $payload = [
        'method' => $method,
        'url'    => 'https://music.163.com' . $apiPath,
        'params' => $params,
    ];
    $body = encode_netease_data($payload);
    return mc_netease_http(
        'POST',
        'https://music.163.com/api/linux/forward',
        $body,
        $cookie,
        true
    );
}

/**
 * 统一 API：先明文 /api/，失败再 linux/forward
 * $apiPath 形如 /api/user/playlist
 */
function mc_netease_api($apiPath, array $params = [], $cookie = '', $method = 'GET')
{
    if ($method === 'GET') {
        $qs = $params ? ('?' . http_build_query($params)) : '';
        $res = mc_netease_http('GET', 'https://music.163.com' . $apiPath . $qs, null, $cookie);
        if ($res['ok'] && $res['json'] !== null) {
            return $res;
        }
    } else {
        $res = mc_netease_http('POST', 'https://music.163.com' . $apiPath, $params, $cookie);
        if ($res['ok'] && $res['json'] !== null) {
            return $res;
        }
    }
    return mc_netease_linux_forward($apiPath, $params, $cookie, $method === 'GET' ? 'GET' : 'POST');
}


/**
 * weapi AES-CBC（与 Binaryify NeteaseCloudMusicApi 一致）
 */
function mc_netease_aes_cbc($text, $key)
{
    return openssl_encrypt($text, 'AES-128-CBC', $key, OPENSSL_RAW_DATA, '0102030405060708');
}

/**
 * weapi RSA_NO_PADDING（GMP 模幂；OpenSSL 3 常拒 NO_PADDING）
 * 公钥取自 NeteaseCloudMusicApi@4.32 util/crypto.js（旧版 modulus/PEM 已失效）
 */
function mc_netease_rsa_encrypt($secretKey)
{
    $nHex = '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b72515'
        . '2b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ec'
        . 'bda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d8'
        . '13cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7';
    $eHex = '010001';
    $buffer = str_pad(strrev($secretKey), 128, "\0", STR_PAD_LEFT);

    if (function_exists('gmp_powm')) {
        $m = gmp_init('0x' . bin2hex($buffer), 16);
        $c = gmp_powm($m, gmp_init('0x' . $eHex, 16), gmp_init('0x' . $nHex, 16));
        $hex = gmp_strval($c, 16);
        if (strlen($hex) % 2) {
            $hex = '0' . $hex;
        }
        return str_pad($hex, 256, '0', STR_PAD_LEFT);
    }

    // 回退：node-forge 同款 PEM（仅旧 OpenSSL 可能支持 NO_PADDING）
    $pubkey = "-----BEGIN PUBLIC KEY-----\n"
        . "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ3\n"
        . "7BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvakl\n"
        . "V8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44o\n"
        . "ncaTWz7OBGLbCiK45wIDAQAB\n"
        . "-----END PUBLIC KEY-----";
    $encrypted = '';
    if (!@openssl_public_encrypt($buffer, $encrypted, $pubkey, OPENSSL_NO_PADDING)) {
        return null;
    }
    return bin2hex($encrypted);
}

/**
 * @return array{params:string,encSecKey:string}|null
 */
function mc_netease_weapi_encode(array $object)
{
    $presetKey = '0CoJUm6Qyw8W8jud';
    $base62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $secretKey = '';
    for ($i = 0; $i < 16; $i++) {
        $secretKey .= $base62[random_int(0, 61)];
    }

    $text = json_encode($object, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $params = base64_encode(mc_netease_aes_cbc($text, $presetKey));
    $params = base64_encode(mc_netease_aes_cbc($params, $secretKey));
    $encSecKey = mc_netease_rsa_encrypt($secretKey);
    if ($encSecKey === null || $encSecKey === '') {
        return null;
    }
    return [
        'params'    => $params,
        'encSecKey' => $encSecKey,
    ];
}

/**
 * POST /weapi/...（收集 Set-Cookie）
 * @return array{ok:bool,body:?string,json:?array,cookies:string,http:int,error:string}
 */
function mc_netease_weapi_request($path, array $data = [], $cookie = '')
{
    $encoded = mc_netease_weapi_encode($data);
    if (!$encoded) {
        return ['ok' => false, 'body' => null, 'json' => null, 'cookies' => '', 'http' => 0, 'error' => 'weapi 加密失败'];
    }
    $csrf = mc_netease_cookie_csrf($cookie);
    $url = 'https://music.163.com' . $path;
    $url .= (strpos($url, '?') === false ? '?' : '&') . 'csrf_token=' . rawurlencode($csrf);
    return mc_netease_http('POST', $url, $encoded, $cookie, true);
}

/**
 * eapi AES-128-ECB（key=e82ckenh8dichen8，与 Binaryify crypto.eapi 一致）
 * @return array{params:string}|null
 */
function mc_netease_eapi_encode($apiPath, array $object)
{
    $text = json_encode($object, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($text === false) {
        return null;
    }
    $message = 'nobody' . $apiPath . 'use' . $text . 'md5forencrypt';
    $digest = md5($message);
    $payload = $apiPath . '-36cd479b6b5-' . $text . '-36cd479b6b5-' . $digest;
    $raw = openssl_encrypt($payload, 'AES-128-ECB', 'e82ckenh8dichen8', OPENSSL_RAW_DATA);
    if ($raw === false || $raw === '') {
        return null;
    }
    return ['params' => strtoupper(bin2hex($raw))];
}

/**
 * eapi 请求头里塞进 body.header / Cookie（客户端指纹）
 */
function mc_netease_eapi_client_header($cookie = '')
{
    $csrf = mc_netease_cookie_csrf($cookie);
    $now = (string) time();
    $header = [
        'osver'       => 'Microsoft-Windows-10-Professional-build-19045-64bit',
        'deviceId'    => 'p' . substr(md5($now . random_int(0, 999999)), 0, 15),
        'os'          => 'pc',
        'appver'      => '3.1.17.204416',
        'versioncode' => '140',
        'mobilename'  => '',
        'buildver'    => substr($now, 0, 10),
        'resolution'  => '1920x1080',
        '__csrf'      => $csrf,
        'channel'     => 'netease',
        'requestId'   => $now . '_' . str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT),
    ];
    if (preg_match('/(?:^|;\s*)MUSIC_U=([^;]+)/', $cookie, $m)) {
        $header['MUSIC_U'] = trim($m[1]);
    }
    return $header;
}

/**
 * POST /eapi/...（优先 interfacepc；失败时回退 music.163.com）
 * $apiPath 形如 /api/login/qrcode/unikey
 * @return array{ok:bool,body:?string,json:?array,cookies:string,http:int,error:string}
 */
function mc_netease_eapi_request($apiPath, array $data = [], $cookie = '')
{
    $header = mc_netease_eapi_client_header($cookie);
    $data['header'] = $header;
    if (!array_key_exists('e_r', $data)) {
        $data['e_r'] = false;
    }
    $encoded = mc_netease_eapi_encode($apiPath, $data);
    if (!$encoded) {
        return ['ok' => false, 'body' => null, 'json' => null, 'cookies' => '', 'http' => 0, 'error' => 'eapi 加密失败'];
    }

    $eapiSuffix = '/eapi/' . ltrim(substr($apiPath, strlen('/api/')), '/');
    $hosts = [
        'https://interfacepc.music.163.com',
        'https://interface.music.163.com',
        'https://music.163.com',
    ];

    $cookieParts = [];
    foreach ($header as $k => $v) {
        $cookieParts[] = rawurlencode((string) $k) . '=' . rawurlencode((string) $v);
    }
    if ($cookie !== '') {
        $cookieParts[] = $cookie;
    }
    $cookieHeader = implode('; ', $cookieParts);

    $last = ['ok' => false, 'body' => null, 'json' => null, 'cookies' => '', 'http' => 0, 'error' => 'eapi 全部失败'];
    foreach ($hosts as $host) {
        $headers = [
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 Chrome/91.0.4472.164 NeteaseMusicDesktop/3.1.29.205117',
            'Referer: https://music.163.com/',
            'Origin: https://music.163.com',
            'Content-Type: application/x-www-form-urlencoded',
            'Cookie: ' . $cookieHeader,
        ];
        $setCookies = [];
        $ch = curl_init($host . $eapiSuffix);
        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query($encoded),
            CURLOPT_HEADERFUNCTION => function ($ch, $hdr) use (&$setCookies) {
                $len = strlen($hdr);
                if (stripos($hdr, 'Set-Cookie:') === 0) {
                    $line = trim(substr($hdr, 11));
                    $pair = explode(';', $line, 2)[0];
                    if (strpos($pair, '=') !== false) {
                        $setCookies[] = trim($pair);
                    }
                }
                return $len;
            },
        ];
        if (defined('CURLOPT_PROXY')) {
            $opts[CURLOPT_PROXY] = '';
        }
        curl_setopt_array($ch, $opts);
        $raw = curl_exec($ch);
        $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        $cookieStr = '';
        if ($setCookies) {
            $map = [];
            foreach ($setCookies as $pair) {
                [$k, $v] = array_pad(explode('=', $pair, 2), 2, '');
                $map[$k] = $k . '=' . $v;
            }
            $cookieStr = implode('; ', array_values($map));
        }

        if ($raw === false) {
            $last = ['ok' => false, 'body' => null, 'json' => null, 'cookies' => '', 'http' => $http, 'error' => $err ?: '请求失败'];
            continue;
        }

        $json = json_decode($raw, true);
        $res = [
            'ok'      => $http >= 200 && $http < 400 && $raw !== '',
            'body'    => $raw,
            'json'    => is_array($json) ? $json : null,
            'cookies' => $cookieStr,
            'http'    => $http,
            'error'   => '',
            'eapiHost'=> $host,
        ];
        // 有 JSON 或 800–803 业务码即视为可用
        $code = (int) ($res['json']['code'] ?? 0);
        if ($res['json'] !== null || ($code >= 800 && $code <= 803)) {
            return $res;
        }
        $last = $res;
    }
    return $last;
}

/**
 * Cookie 名列表（不记录值，避免日志泄露）
 */
function mc_netease_cookie_keys($cookie)
{
    $keys = [];
    foreach (explode(';', (string) $cookie) as $part) {
        $part = trim($part);
        if ($part === '' || strpos($part, '=') === false) {
            continue;
        }
        $keys[] = trim(explode('=', $part, 2)[0]);
    }
    return implode(',', $keys);
}

/**
 * 从响应提取 Cookie：优先 Set-Cookie，其次 JSON cookie 字段，再次 body 内 MUSIC_U=
 */
function mc_netease_extract_login_cookie(array $res)
{
    $cookie = mc_netease_merge_cookies('', $res['cookies'] ?? '');

    $jsonCookie = $res['json']['cookie'] ?? null;
    if ($jsonCookie !== null && $jsonCookie !== '') {
        if (is_array($jsonCookie)) {
            $jsonCookie = implode('; ', array_map('strval', $jsonCookie));
        } else {
            // body 里常是转义后的 "MUSIC_U=...; __csrf=..."
            $jsonCookie = stripcslashes((string) $jsonCookie);
        }
        $cookie = mc_netease_merge_cookies($cookie, mc_netease_normalize_cookie((string) $jsonCookie));
    }

    $body = (string) ($res['body'] ?? '');
    if (stripos($cookie, 'MUSIC_U=') === false && $body !== '') {
        // 兼容 JSON 转义 MUSIC_U=xxx\; 或 MUSIC_U=xxx"
        if (preg_match('/MUSIC_U=([^;\\s"\\\\]+)/', $body, $m)) {
            $cookie = mc_netease_merge_cookies($cookie, 'MUSIC_U=' . $m[1]);
        } elseif (preg_match('/MUSIC_U\\\\?=\\\\?"?([^\\\\";\\s]+)/', $body, $m)) {
            $cookie = mc_netease_merge_cookies($cookie, 'MUSIC_U=' . $m[1]);
        }
    }
    if (stripos($cookie, '__csrf=') === false && $body !== '') {
        if (preg_match('/__csrf=([^;\\s"\\\\]+)/', $body, $m)) {
            $cookie = mc_netease_merge_cookies($cookie, '__csrf=' . $m[1]);
        }
    }
    return $cookie;
}

function mc_netease_qr_debug_log($stage, array $res, $key = '')
{
    $body = (string) ($res['body'] ?? '');
    // 日志不写完整 cookie 值，只记 keys + body 片段（抹掉 MUSIC_U 值）
    $snippet = substr(preg_replace('/MUSIC_U=[^;\\s"\\\\]+/', 'MUSIC_U=<redacted>', $body), 0, 500);
    $cookieKeys = mc_netease_cookie_keys($res['cookies'] ?? '');
    $jsonKeys = '';
    if (!empty($res['json']['cookie'])) {
        $jc = $res['json']['cookie'];
        if (is_array($jc)) {
            $jc = implode('; ', $jc);
        }
        $jsonKeys = mc_netease_cookie_keys((string) $jc);
    }
    $line = sprintf(
        "[%s] stage=%s key=%s http=%s code=%s hasMUSIC_U=%s setCookieKeys=%s jsonCookieKeys=%s eapiHost=%s body=%s\n",
        date('c'),
        $stage,
        substr((string) $key, 0, 48),
        (string) ($res['http'] ?? 0),
        (string) ($res['json']['code'] ?? ''),
        (stripos(($res['cookies'] ?? '') . $body, 'MUSIC_U=') !== false) ? '1' : '0',
        $cookieKeys,
        $jsonKeys,
        (string) ($res['eapiHost'] ?? ''),
        $snippet
    );
    @error_log('netease_qr ' . trim($line));
    $file = mc_qq_cache_dir('netease_auth') . '/qr_debug.log';
    @file_put_contents($file, $line, FILE_APPEND | LOCK_EX);
}

function mc_netease_account_get($cookie)
{
    $res = mc_netease_api('/api/nuser/account/get', [], $cookie, 'POST');
    if (!$res['json']) {
        $res = mc_netease_api('/api/w/nuser/account/get', [], $cookie, 'POST');
    }
    if (!$res['json']) {
        return null;
    }
    $profile = $res['json']['profile'] ?? null;
    $account = $res['json']['account'] ?? null;
    $uid = 0;
    if (is_array($profile) && !empty($profile['userId'])) {
        $uid = (int) $profile['userId'];
    } elseif (is_array($account) && !empty($account['id'])) {
        $uid = (int) $account['id'];
    }
    if ($uid <= 0) {
        return null;
    }
    return [
        'uid'      => $uid,
        'nickname' => is_array($profile) ? (string) ($profile['nickname'] ?? '') : '',
        'avatar'   => is_array($profile) ? (string) ($profile['avatarUrl'] ?? '') : '',
    ];
}

function mc_netease_track_from_song(array $song)
{
    $id = $song['id'] ?? null;
    if (!$id) {
        return null;
    }
    $artists = [];
    if (!empty($song['ar']) && is_array($song['ar'])) {
        foreach ($song['ar'] as $a) {
            if (!empty($a['name'])) {
                $artists[] = $a['name'];
            }
        }
    } elseif (!empty($song['artists']) && is_array($song['artists'])) {
        foreach ($song['artists'] as $a) {
            if (!empty($a['name'])) {
                $artists[] = $a['name'];
            }
        }
    }
    $pic = '';
    if (!empty($song['al']['picUrl'])) {
        $pic = $song['al']['picUrl'];
    } elseif (!empty($song['album']['picUrl'])) {
        $pic = $song['album']['picUrl'];
    }
    return [
        'type'   => 'netease',
        'songid' => (string) $id,
        'title'  => (string) ($song['name'] ?? '未知曲目'),
        'author' => $artists ? implode(', ', $artists) : '未知艺人',
        'link'   => 'https://music.163.com/#/song?id=' . $id,
        'pic'    => $pic,
    ];
}

function mc_netease_songs_by_ids(array $ids, $cookie)
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
    if (!$ids) {
        return [];
    }
    $out = [];
    foreach (array_chunk($ids, 200) as $chunk) {
        $res = mc_netease_api('/api/v3/song/detail', [
            'c'   => json_encode(array_map(function ($id) {
                return ['id' => $id];
            }, $chunk)),
            'ids' => implode(',', $chunk),
        ], $cookie, 'POST');
        $songs = $res['json']['songs'] ?? [];
        if (!is_array($songs)) {
            continue;
        }
        foreach ($songs as $song) {
            $t = mc_netease_track_from_song($song);
            if ($t) {
                $out[] = $t;
            }
        }
    }
    return $out;
}

function mc_netease_page_params()
{
    $offset = max(0, (int) post('offset'));
    $limit = (int) post('limit');
    if ($limit <= 0) {
        $limit = 10;
    }
    if ($limit > 50) {
        $limit = 50;
    }
    return [$offset, $limit];
}

/** 拉取歌单全部曲目 ID（playlist.trackIds），不截断。 */
function mc_netease_playlist_track_ids($playlistId, $cookie)
{
    $res = mc_netease_api('/api/v6/playlist/detail', [
        'id' => (int) $playlistId,
        'n'  => 100000,
        's'  => 0,
    ], $cookie, 'POST');
    $playlist = $res['json']['playlist'] ?? null;
    if (!is_array($playlist)) {
        return ['ids' => [], 'name' => '', 'total' => 0];
    }
    $trackIds = [];
    if (!empty($playlist['trackIds']) && is_array($playlist['trackIds'])) {
        foreach ($playlist['trackIds'] as $row) {
            if (is_array($row) && !empty($row['id'])) {
                $trackIds[] = (int) $row['id'];
            } elseif (is_numeric($row)) {
                $trackIds[] = (int) $row;
            }
        }
    } elseif (!empty($playlist['tracks']) && is_array($playlist['tracks'])) {
        foreach ($playlist['tracks'] as $song) {
            if (!empty($song['id'])) {
                $trackIds[] = (int) $song['id'];
            }
        }
    }
    $total = count($trackIds);
    $hint = (int) ($playlist['trackCount'] ?? 0);
    if ($hint > $total) {
        $total = $hint;
    }
    return [
        'ids'   => $trackIds,
        'name'  => (string) ($playlist['name'] ?? ''),
        'total' => $total,
    ];
}

/** 歌单分页：返回全部 trackIds + 当前页 tracks。 */
function mc_netease_playlist_page($playlistId, $cookie, $offset = 0, $limit = 10)
{
    $meta = mc_netease_playlist_track_ids($playlistId, $cookie);
    $ids = $meta['ids'];
    $offset = max(0, (int) $offset);
    $limit = max(1, (int) $limit);
    $pageIds = array_slice($ids, $offset, $limit);
    return [
        'id'       => (string) ((int) $playlistId),
        'name'     => $meta['name'],
        'total'    => count($ids) > 0 ? count($ids) : (int) $meta['total'],
        'trackIds' => $ids,
        'tracks'   => mc_netease_songs_by_ids($pageIds, $cookie),
    ];
}

function mc_netease_public_status()
{
    $auth = mc_netease_auth_read();
    if (!$auth) {
        return ['loggedIn' => false];
    }
    return [
        'loggedIn'  => true,
        'uid'       => (int) ($auth['uid'] ?? 0),
        'nickname'  => (string) ($auth['nickname'] ?? ''),
        'avatar'    => (string) ($auth['avatar'] ?? ''),
        'updatedAt' => (int) ($auth['updatedAt'] ?? 0),
    ];
}

function mc_netease_account_handle($action)
{
    switch ($action) {
        case 'netease_status':
            response(mc_netease_public_status(), 200, '');
            break;

        case 'netease_logout':
            mc_netease_auth_clear();
            response(['ok' => true], 200, '');
            break;

        case 'netease_cookie_save':
            $cookie = mc_netease_normalize_cookie(post('cookie'));
            if ($cookie === '' || stripos($cookie, 'MUSIC_U=') === false) {
                response('', 400, '请粘贴包含 MUSIC_U 的 Cookie');
            }
            $account = mc_netease_account_get($cookie);
            if (!$account) {
                response('', 401, 'Cookie 无效或已过期，请重新从浏览器复制');
            }
            mc_netease_auth_write([
                'cookie'   => $cookie,
                'csrf'     => mc_netease_cookie_csrf($cookie),
                'uid'      => $account['uid'],
                'nickname' => $account['nickname'],
                'avatar'   => $account['avatar'],
            ]);
            response(mc_netease_public_status(), 200, '');
            break;

        case 'netease_qr_key':
            // 与 check 同一加密路径：eapi + type=3（weapi/type=1 确认后会卡 802）
            $unikey = '';
            $via = '';
            $res = mc_netease_eapi_request('/api/login/qrcode/unikey', ['type' => 3], '');
            $unikey = (string) ($res['json']['unikey'] ?? '');
            if ($unikey !== '') {
                $via = 'eapi';
            }
            if ($unikey === '') {
                $res = mc_netease_weapi_request('/weapi/login/qrcode/unikey', ['type' => 3], '');
                $unikey = (string) ($res['json']['unikey'] ?? '');
                if ($unikey !== '') {
                    $via = 'weapi-t3';
                }
            }
            if ($unikey === '') {
                $res = mc_netease_api('/api/login/qrcode/unikey', ['type' => 3], '', 'POST');
                $unikey = (string) ($res['json']['unikey'] ?? '');
                if ($unikey !== '') {
                    $via = 'api-t3';
                }
            }
            if ($unikey === '') {
                $res = mc_netease_api('/api/login/qrcode/unikey', ['type' => 1], '', 'GET');
                $unikey = (string) ($res['json']['unikey'] ?? '');
                if ($unikey !== '') {
                    $via = 'api-t1';
                }
            }
            if ($unikey === '') {
                mc_netease_qr_debug_log('qr_key_fail', $res ?: [], '');
                response('', 502, '无法获取二维码，请稍后重试或改用 Cookie');
            }
            mc_netease_qr_debug_log('qr_key:' . $via, $res, $unikey);
            response([
                'key'   => $unikey,
                'qrurl' => 'https://music.163.com/login?codekey=' . rawurlencode($unikey),
                'via'   => $via,
            ], 200, '');
            break;

        case 'netease_qr_check':
            $key = trim((string) post('key'));
            if ($key === '') {
                response('', 400, '缺少二维码 key');
            }
            // key 与 check 必须同路径；优先 eapi type=3（官方客户端 / Enhanced API）
            $params = ['type' => 3, 'key' => $key];
            $res = mc_netease_eapi_request('/api/login/qrcode/client/login', $params, '');
            $via = 'eapi';
            $code = (int) ($res['json']['code'] ?? 0);
            if (!$res['json'] || $code === 0) {
                $res = mc_netease_weapi_request('/weapi/login/qrcode/client/login', $params, '');
                $via = 'weapi-t3';
                $code = (int) ($res['json']['code'] ?? 0);
            }
            if (!$res['json'] || $code === 0) {
                $res = mc_netease_api('/api/login/qrcode/client/login', $params, '', 'POST');
                $via = 'api-t3';
                $code = (int) ($res['json']['code'] ?? 0);
            }
            // 兼容旧 key（type=1 weapi 生成）
            if (!$res['json'] || $code === 0 || ($code === 800 && $via === 'eapi')) {
                $legacy = ['type' => 1, 'key' => $key];
                $try = mc_netease_weapi_request('/weapi/login/qrcode/client/login', $legacy, '');
                $tryCode = (int) ($try['json']['code'] ?? 0);
                if ($tryCode > 0 && $tryCode !== 800) {
                    $res = $try;
                    $code = $tryCode;
                    $via = 'weapi-t1';
                    $params = $legacy;
                } elseif ($tryCode > 0 && ($code === 0 || !$res['json'])) {
                    $res = $try;
                    $code = $tryCode;
                    $via = 'weapi-t1';
                    $params = $legacy;
                }
            }
            if ($code === 801 || $code === 802 || $code === 803 || $code === 800) {
                mc_netease_qr_debug_log($via . ':' . $code, $res, $key);
            }
            $payload = [
                'status'  => $code,
                'message' => (string) ($res['json']['message'] ?? ''),
                'via'     => $via,
            ];
            if ($code === 803) {
                $cookie = mc_netease_extract_login_cookie($res);
                if ($cookie === '' || stripos($cookie, 'MUSIC_U=') === false) {
                    // 803 只出现一次：用同一路径再打一次专拿 Set-Cookie / body.cookie
                    $retry = mc_netease_eapi_request('/api/login/qrcode/client/login', $params, '');
                    mc_netease_qr_debug_log('eapi-803-retry', $retry, $key);
                    $cookie = mc_netease_merge_cookies($cookie, mc_netease_extract_login_cookie($retry));
                }
                if ($cookie === '' || stripos($cookie, 'MUSIC_U=') === false) {
                    $retry = mc_netease_weapi_request('/weapi/login/qrcode/client/login', $params, '');
                    mc_netease_qr_debug_log('weapi-803-retry', $retry, $key);
                    $cookie = mc_netease_merge_cookies($cookie, mc_netease_extract_login_cookie($retry));
                }
                mc_netease_qr_debug_log('803-cookie-keys:' . mc_netease_cookie_keys($cookie), [
                    'http' => $res['http'] ?? 0,
                    'body' => substr((string) ($res['body'] ?? ''), 0, 200),
                    'cookies' => '',
                    'json' => ['code' => 803],
                ], $key);
                if ($cookie === '' || stripos($cookie, 'MUSIC_U=') === false) {
                    response(array_merge($payload, [
                        'loggedIn' => false,
                        'debugVia' => $via,
                    ]), 502, '扫码成功但未拿到 Cookie，请改用 Cookie 登录');
                }
                $account = mc_netease_account_get($cookie);
                if (!$account) {
                    response(array_merge($payload, ['loggedIn' => false]), 502, '登录态校验失败，请改用 Cookie');
                }
                mc_netease_auth_write([
                    'cookie'   => $cookie,
                    'csrf'     => mc_netease_cookie_csrf($cookie),
                    'uid'      => $account['uid'],
                    'nickname' => $account['nickname'],
                    'avatar'   => $account['avatar'],
                ]);
                $payload['loggedIn'] = true;
                $payload['uid'] = $account['uid'];
                $payload['nickname'] = $account['nickname'];
                $payload['avatar'] = $account['avatar'];
            }
            response($payload, 200, '');
            break;

        case 'netease_playlists':
            $auth = mc_netease_auth_read();
            if (!$auth) {
                response('', 401, '请先登录网易云');
            }
            $uid = (int) ($auth['uid'] ?? 0);
            $res = mc_netease_api('/api/user/playlist', [
                'uid'    => $uid,
                'limit'  => 1000,
                'offset' => 0,
            ], $auth['cookie'], 'POST');
            $list = $res['json']['playlist'] ?? [];
            if (!is_array($list)) {
                response('', 502, '拉取歌单失败');
            }
            $out = [];
            foreach ($list as $pl) {
                $out[] = [
                    'id'          => (string) ($pl['id'] ?? ''),
                    'name'        => (string) ($pl['name'] ?? '未命名歌单'),
                    'cover'       => (string) ($pl['coverImgUrl'] ?? ''),
                    'trackCount'  => (int) ($pl['trackCount'] ?? 0),
                    'specialType' => (int) ($pl['specialType'] ?? 0),
                    'subscribed'  => !empty($pl['subscribed']),
                ];
            }
            response(['playlists' => $out], 200, '');
            break;

        case 'netease_likelist':
            $auth = mc_netease_auth_read();
            if (!$auth) {
                response('', 401, '请先登录网易云');
            }
            list($offset, $limit) = mc_netease_page_params();
            $uid = (int) ($auth['uid'] ?? 0);
            $res = mc_netease_api('/api/song/like/get', ['uid' => $uid], $auth['cookie'], 'POST');
            $ids = $res['json']['ids'] ?? [];
            if (!is_array($ids) || !$ids) {
                $plRes = mc_netease_api('/api/user/playlist', [
                    'uid'    => $uid,
                    'limit'  => 50,
                    'offset' => 0,
                ], $auth['cookie'], 'POST');
                $likedId = 0;
                foreach (($plRes['json']['playlist'] ?? []) as $pl) {
                    if ((int) ($pl['specialType'] ?? 0) === 5) {
                        $likedId = (int) ($pl['id'] ?? 0);
                        break;
                    }
                }
                if ($likedId > 0) {
                    $page = mc_netease_playlist_page($likedId, $auth['cookie'], $offset, $limit);
                    response([
                        'playlistId' => (string) $likedId,
                        'name'       => $page['name'] !== '' ? $page['name'] : '我喜欢',
                        'total'      => $page['total'],
                        'trackIds'   => $page['trackIds'],
                        'tracks'     => $page['tracks'],
                    ], 200, '');
                }
                response([
                    'playlistId' => '',
                    'name'       => '我喜欢',
                    'total'      => 0,
                    'trackIds'   => [],
                    'tracks'     => [],
                ], 200, '');
            }
            $allIds = array_values(array_map('intval', $ids));
            $pageIds = array_slice($allIds, $offset, $limit);
            response([
                'playlistId' => 'likelist',
                'name'       => '我喜欢',
                'total'      => count($allIds),
                'trackIds'   => $allIds,
                'tracks'     => mc_netease_songs_by_ids($pageIds, $auth['cookie']),
            ], 200, '');
            break;

        case 'netease_playlist_detail':
            $auth = mc_netease_auth_read();
            if (!$auth) {
                response('', 401, '请先登录网易云');
            }
            $id = trim((string) post('id'));
            if ($id === '' || !preg_match('/^\d+$/', $id)) {
                response('', 400, '歌单 ID 无效');
            }
            list($offset, $limit) = mc_netease_page_params();
            $page = mc_netease_playlist_page((int) $id, $auth['cookie'], $offset, $limit);
            response([
                'id'       => $id,
                'name'     => $page['name'],
                'total'    => $page['total'],
                'trackIds' => $page['trackIds'],
                'tracks'   => $page['tracks'],
            ], 200, '');
            break;

        case 'netease_songs_by_ids':
            $auth = mc_netease_auth_read();
            if (!$auth) {
                response('', 401, '请先登录网易云');
            }
            $raw = trim((string) post('ids'));
            if ($raw === '') {
                response(['tracks' => []], 200, '');
            }
            $ids = array_values(array_filter(array_map('intval', explode(',', $raw))));
            if (count($ids) > 10) {
                $ids = array_slice($ids, 0, 10);
            }
            response([
                'tracks' => mc_netease_songs_by_ids($ids, $auth['cookie']),
            ], 200, '');
            break;

        default:
            response('', 400, '未知操作');
    }
}
