<?php
/**
 * QQ 音乐账号级同步：本机 Cookie + 扫码 / Cookie 登录 + 歌单拉取
 * 播放仍走现有 mc_qq_wrap_track / api.php，不依赖官方 App。
 * 由 music.php require。
 */

if (!defined('MC_CORE')) {
    exit;
}

function mc_qq_auth_file()
{
    return mc_qq_cache_dir('qq_auth') . '/session.json';
}

function mc_qq_auth_read()
{
    $file = mc_qq_auth_file();
    if (!is_file($file)) {
        return null;
    }
    $raw = @file_get_contents($file);
    if ($raw === false || $raw === '') {
        return null;
    }
    $data = json_decode($raw, true);
    if (!is_array($data) || empty($data['cookie']) || empty($data['uin'])) {
        return null;
    }
    return $data;
}

function mc_qq_auth_write(array $data)
{
    $data['updatedAt'] = time();
    $file = mc_qq_auth_file();
    @file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
}

function mc_qq_auth_clear()
{
    $file = mc_qq_auth_file();
    if (is_file($file)) {
        @unlink($file);
    }
}

function mc_qq_normalize_cookie($cookie)
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

function mc_qq_cookie_map($cookie)
{
    $map = [];
    foreach (explode(';', (string) $cookie) as $part) {
        $part = trim($part);
        if ($part === '' || strpos($part, '=') === false) {
            continue;
        }
        [$k, $v] = explode('=', $part, 2);
        $k = trim($k);
        if ($k !== '') {
            $map[$k] = trim($v);
        }
    }
    return $map;
}

function mc_qq_merge_cookies($existing, $incoming)
{
    $map = mc_qq_cookie_map($existing);
    foreach (mc_qq_cookie_map($incoming) as $k => $v) {
        // Set-Cookie 常有「清空」写法 p_skey=; 勿用空值覆盖已有有效值
        if ($v === '' && isset($map[$k]) && $map[$k] !== '') {
            continue;
        }
        $map[$k] = $v;
    }
    $parts = [];
    foreach ($map as $k => $v) {
        $parts[] = $k . '=' . $v;
    }
    return implode('; ', $parts);
}

function mc_qq_cookie_get($cookie, $key)
{
    $map = mc_qq_cookie_map($cookie);
    return isset($map[$key]) ? $map[$key] : '';
}

function mc_qq_extract_uin($cookie)
{
    $map = mc_qq_cookie_map($cookie);
    if (!empty($map['login_type']) && (int) $map['login_type'] === 2 && !empty($map['wxuin'])) {
        return preg_replace('/\D/', '', $map['wxuin']);
    }
    foreach (['uin', 'qqmusic_uin', 'wxuin', 'p_uin', 'pt2gguin', 'superuin'] as $k) {
        if (!empty($map[$k])) {
            $uin = preg_replace('/\D/', '', $map[$k]);
            if ($uin !== '') {
                return $uin;
            }
        }
    }
    return '';
}

function mc_qq_has_music_key($cookie)
{
    $map = mc_qq_cookie_map($cookie);
    return !empty($map['qm_keyst']) || !empty($map['qqmusic_key']);
}

function mc_qq_hash33($t)
{
    $e = 0;
    $len = strlen($t);
    for ($n = 0; $n < $len; ++$n) {
        $e = ($e + (($e << 5) & 0x7fffffff) + ord($t[$n])) & 0x7fffffff;
    }
    return $e & 2147483647;
}

function mc_qq_gtk($skey)
{
    $hash = 5381;
    $len = strlen($skey);
    for ($i = 0; $i < $len; ++$i) {
        $hash = ($hash + (($hash << 5) & 0x7fffffff) + ord($skey[$i])) & 0x7fffffff;
    }
    return $hash & 2147483647;
}

/**
 * @return array{ok:bool,body:?string,json:?array,cookies:string,http:int,error:string,headers:string}
 */
function mc_qq_http($method, $url, $body = null, $cookie = '', array $extraHeaders = [])
{
    $headers = array_merge([
        'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer: https://y.qq.com/',
        'Origin: https://y.qq.com',
    ], $extraHeaders);
    if ($cookie !== '') {
        $headers[] = 'Cookie: ' . $cookie;
    }
    if ($method === 'POST' && $body !== null && is_array($body)) {
        $headers[] = 'Content-Type: application/x-www-form-urlencoded';
        $body = http_build_query($body);
    } elseif ($method === 'POST' && is_string($body) && strpos($body, '{') === 0) {
        $headers[] = 'Content-Type: application/json';
    }

    $setCookies = [];
    $rawHeaders = '';
    $ch = curl_init($url);
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_CUSTOMREQUEST  => strtoupper($method),
        CURLOPT_HEADERFUNCTION => function ($ch, $header) use (&$setCookies, &$rawHeaders) {
            $rawHeaders .= $header;
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
        $opts[CURLOPT_POSTFIELDS] = $body;
    } elseif ($method === 'GET' && $body !== null) {
        // unused
    }
    curl_setopt_array($ch, $opts);
    $raw = curl_exec($ch);
    $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        return ['ok' => false, 'body' => null, 'json' => null, 'cookies' => '', 'http' => $http, 'error' => $err ?: '请求失败', 'headers' => $rawHeaders];
    }

    $cookieStr = '';
    if ($setCookies) {
        $map = [];
        foreach ($setCookies as $pair) {
            [$k, $v] = array_pad(explode('=', $pair, 2), 2, '');
            $k = trim($k);
            $v = trim($v);
            if ($k === '') {
                continue;
            }
            // 同响应内后到的空值不覆盖先到的非空值
            if ($v === '' && isset($map[$k]) && substr($map[$k], strlen($k) + 1) !== '') {
                continue;
            }
            $map[$k] = $k . '=' . $v;
        }
        $cookieStr = implode('; ', array_values($map));
    }

    $json = json_decode($raw, true);
    if (!is_array($json) && preg_match('/^\w+\((.*)\);?\s*$/s', trim($raw), $m)) {
        $json = json_decode($m[1], true);
    }

    return [
        'ok'      => $http >= 200 && $http < 400,
        'body'    => $raw,
        'json'    => is_array($json) ? $json : null,
        'cookies' => $cookieStr,
        'http'    => $http,
        'error'   => '',
        'headers' => $rawHeaders,
    ];
}

function mc_qq_qr_session_file()
{
    return mc_qq_cache_dir('qq_auth') . '/qr_session.json';
}

function mc_qq_public_status()
{
    $auth = mc_qq_auth_read();
    if (!$auth) {
        return ['loggedIn' => false];
    }
    return [
        'loggedIn'  => true,
        'uin'       => (string) ($auth['uin'] ?? ''),
        'nickname'  => (string) ($auth['nickname'] ?? ''),
        'updatedAt' => (int) ($auth['updatedAt'] ?? 0),
    ];
}

function mc_qq_profile_validate($cookie)
{
    $uin = mc_qq_extract_uin($cookie);
    if ($uin === '' || !mc_qq_has_music_key($cookie)) {
        return null;
    }
    $res = mc_qq_http('GET', 'https://c6.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?' . http_build_query([
        'cid'     => 205360838,
        'userid'  => $uin,
        'loginUin'=> $uin,
        'reqfrom' => 1,
        'format'  => 'json',
    ]), null, $cookie, [
        'Referer: https://y.qq.com/portal/profile.html?uin=' . rawurlencode($uin),
    ]);
    if (!$res['json'] || (int) ($res['json']['code'] ?? -1) === 1000) {
        return null;
    }
    $nickname = '';
    if (!empty($res['json']['data']['creator']['nick'])) {
        $nickname = (string) $res['json']['data']['creator']['nick'];
    } elseif (!empty($res['json']['data']['userinfo']['nick'])) {
        $nickname = (string) $res['json']['data']['userinfo']['nick'];
    }
    return [
        'uin'      => $uin,
        'nickname' => $nickname !== '' ? $nickname : ('QQ ' . $uin),
        'cookie'   => $cookie,
    ];
}

function mc_qq_track_from_song(array $song)
{
    $mid = $song['songmid'] ?? ($song['mid'] ?? '');
    if ($mid === '') {
        return null;
    }
    $artists = [];
    if (!empty($song['singer']) && is_array($song['singer'])) {
        foreach ($song['singer'] as $s) {
            if (!empty($s['name'])) {
                $artists[] = $s['name'];
            }
        }
    }
    $albummid = $song['albummid'] ?? ($song['album']['mid'] ?? '');
    $pic = $albummid !== ''
        ? ('https://y.gtimg.cn/music/photo_new/T002R300x300M000' . $albummid . '.jpg')
        : '';
    return [
        'type'   => 'qq',
        'songid' => (string) $mid,
        'title'  => (string) ($song['songname'] ?? ($song['title'] ?? ($song['name'] ?? '未知曲目'))),
        'author' => $artists ? implode(', ', $artists) : '未知艺人',
        'link'   => 'https://y.qq.com/n/ryqq/songDetail/' . $mid,
        'pic'    => $pic,
    ];
}

function mc_qq_playlist_tracks($dissid, $cookie)
{
    $dissid = preg_replace('/\D/', '', (string) $dissid);
    if ($dissid === '') {
        return [];
    }
    $res = mc_qq_http('GET', 'https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?' . http_build_query([
        'type'    => 1,
        'utf8'    => 1,
        'disstid' => $dissid,
        'format'  => 'json',
    ]), null, $cookie, [
        'Referer: https://y.qq.com/n/yqq/playlist/' . $dissid . '.html',
    ]);
    $list = $res['json']['cdlist'][0]['songlist'] ?? [];
    if (!is_array($list)) {
        return [];
    }
    $out = [];
    foreach ($list as $song) {
        $t = mc_qq_track_from_song($song);
        if ($t) {
            $out[] = $t;
        }
    }
    return $out;
}

function mc_qq_fetch_playlists($uin, $cookie)
{
    $out = [];
    $res = mc_qq_http('GET', 'https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss?' . http_build_query([
        'hostUin'     => 0,
        'hostuin'     => $uin,
        'sin'         => 0,
        'size'        => 200,
        'g_tk'        => 5381,
        'loginUin'    => $uin,
        'format'      => 'json',
        'inCharset'   => 'utf8',
        'outCharset'  => 'utf-8',
        'notice'      => 0,
        'platform'    => 'yqq.json',
        'needNewCode' => 0,
    ]), null, $cookie, [
        'Referer: https://y.qq.com/portal/profile.html',
    ]);
    $list = $res['json']['data']['disslist'] ?? [];
    if (is_array($list)) {
        foreach ($list as $pl) {
            $tid = (string) ($pl['tid'] ?? ($pl['diss_id'] ?? ''));
            if ($tid === '' || $tid === '0') {
                continue;
            }
            $out[] = [
                'id'         => $tid,
                'name'       => (string) ($pl['diss_name'] ?? '未命名歌单'),
                'cover'      => (string) ($pl['diss_cover'] ?? ''),
                'trackCount' => (int) ($pl['song_cnt'] ?? 0),
                'dirid'      => (int) ($pl['dirid'] ?? 0),
                'subscribed' => false,
            ];
        }
    }

    // 收藏的别人的歌单
    $fav = mc_qq_http('GET', 'https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg?' . http_build_query([
        'ct'      => 20,
        'cid'     => 205360956,
        'userid'  => $uin,
        'reqtype' => 3,
        'sin'     => 0,
        'ein'     => 49,
    ]), null, $cookie);
    $cdlist = $fav['json']['data']['cdlist'] ?? [];
    if (is_array($cdlist)) {
        foreach ($cdlist as $pl) {
            $tid = (string) ($pl['disstid'] ?? ($pl['tid'] ?? ($pl['id'] ?? '')));
            if ($tid === '' || $tid === '0') {
                continue;
            }
            $out[] = [
                'id'         => $tid,
                'name'       => (string) ($pl['dissname'] ?? ($pl['title'] ?? '收藏歌单')),
                'cover'      => (string) ($pl['logo'] ?? ($pl['pic'] ?? '')),
                'trackCount' => (int) ($pl['song_cnt'] ?? ($pl['songnum'] ?? 0)),
                'dirid'      => 0,
                'subscribed' => true,
            ];
        }
    }

    // 去重
    $seen = [];
    $uniq = [];
    foreach ($out as $pl) {
        if (isset($seen[$pl['id']])) {
            continue;
        }
        $seen[$pl['id']] = true;
        $uniq[] = $pl;
    }
    return $uniq;
}

function mc_qq_qr_debug($msg, array $extra = [])
{
    $line = date('c') . ' ' . $msg;
    if ($extra) {
        $line .= ' ' . json_encode($extra, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    $line .= "\n";
    @file_put_contents(mc_qq_cache_dir('qq_auth') . '/qr_debug.log', $line, FILE_APPEND);
}

function mc_qq_unescape_redirect_url($url)
{
    $url = html_entity_decode((string) $url, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $url = stripcslashes($url);
    $url = str_replace(['\\/', '\\u0026', '\\u003d', '\\u003f'], ['/', '&', '=', '?'], $url);
    if (preg_match('/\\\\u([0-9a-fA-F]{4})/', $url)) {
        $url = preg_replace_callback('/\\\\u([0-9a-fA-F]{4})/', function ($m) {
            return mb_convert_encoding(pack('H*', $m[1]), 'UTF-8', 'UCS-2BE');
        }, $url);
    }
    return trim($url);
}

function mc_qq_extract_location($headers)
{
    if (!is_string($headers) || $headers === '') {
        return '';
    }
    if (preg_match('/^Location:\s*(.+)$/mi', $headers, $m)) {
        return mc_qq_unescape_redirect_url(trim($m[1]));
    }
    return '';
}

function mc_qq_resolve_url($base, $loc)
{
    $loc = mc_qq_unescape_redirect_url($loc);
    if ($loc === '') {
        return '';
    }
    if (preg_match('#^https?://#i', $loc)) {
        return $loc;
    }
    $p = parse_url($base);
    if (!$p || empty($p['scheme']) || empty($p['host'])) {
        return $loc;
    }
    $origin = $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
    if (isset($loc[0]) && $loc[0] === '/') {
        return $origin . $loc;
    }
    $dir = isset($p['path']) ? preg_replace('#/[^/]*$#', '/', $p['path']) : '/';
    return $origin . $dir . $loc;
}

function mc_qq_cookie_summary($cookie)
{
    $map = mc_qq_cookie_map($cookie);
    $keys = array_keys($map);
    $nonEmpty = [];
    foreach (['p_skey', 'skey', 'uin', 'p_uin', 'qm_keyst', 'qqmusic_key', 'pt_oauth_token', 'superkey', 'pt4_token'] as $k) {
        if (!empty($map[$k])) {
            $nonEmpty[$k] = strlen((string) $map[$k]);
        }
    }
    return [
        'keys'      => $keys,
        'non_empty' => $nonEmpty,
        'p_skey_len'=> isset($map['p_skey']) ? strlen((string) $map['p_skey']) : -1,
        'forbid'    => isset($map['p_skey_forbid']),
    ];
}

function mc_qq_pick_gtk_key($cookie)
{
    foreach (['p_skey', 'skey', 'p_lskey', 'lskey'] as $k) {
        $v = mc_qq_cookie_get($cookie, $k);
        if ($v !== '') {
            return [$k, $v];
        }
    }
    return ['', ''];
}

/**
 * 跟随 Location，收集各跳 Set-Cookie（不自动 FOLLOWLOCATION，避免丢 cookie）
 *
 * @return array{cookie:string,last:array,hops:int}
 */
function mc_qq_follow_collect($url, $cookie, $maxHops = 10, $referer = 'https://xui.ptlogin2.qq.com/')
{
    $url = mc_qq_unescape_redirect_url($url);
    $last = null;
    $hops = 0;
    for ($i = 0; $i < $maxHops; $i++) {
        if ($url === '') {
            break;
        }
        $res = mc_qq_http('GET', $url, null, $cookie, [
            'Referer: ' . $referer,
        ]);
        $hops++;
        $cookie = mc_qq_merge_cookies($cookie, $res['cookies']);
        $last = $res;
        $loc = mc_qq_extract_location($res['headers']);
        mc_qq_qr_debug('follow_hop', [
            'i'        => $i,
            'http'     => $res['http'],
            'url_host' => (string) (parse_url($url, PHP_URL_HOST) ?: ''),
            'has_loc'  => $loc !== '',
            'cookies'  => mc_qq_cookie_summary($cookie),
        ]);
        // 从 body 里捞 code（wx_redirect / 中间页）
        if ($loc === '' && is_string($res['body'])) {
            if (preg_match('/(?:location\.href|window\.location)\s*=\s*["\']([^"\']+)["\']/i', $res['body'], $m)) {
                $loc = $m[1];
            } elseif (preg_match('/http-equiv=["\']?refresh["\']?[^>]*content=["\'][^"\']*url=([^"\'>\s]+)/i', $res['body'], $m)) {
                $loc = html_entity_decode($m[1], ENT_QUOTES, 'UTF-8');
            }
        }
        if ($loc === '') {
            break;
        }
        $referer = $url;
        $url = mc_qq_resolve_url($url, $loc);
    }
    return ['cookie' => $cookie, 'last' => $last, 'hops' => $hops];
}

function mc_qq_extract_oauth_code($headers, $body, $loc = '')
{
    $hay = $loc . "\n" . (string) $headers . "\n" . (string) $body;
    $hay = html_entity_decode($hay, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $hay = str_replace('\\/', '/', $hay);
    if (preg_match('/[?&#]code=([^&"\'<>\s]+)/', $hay, $m)) {
        return urldecode($m[1]);
    }
    return '';
}

function mc_qq_apply_music_login_data($cookie, $data)
{
    if (!is_array($data)) {
        return $cookie;
    }
    if (!empty($data['musicid'])) {
        $mid = preg_replace('/\D/', '', (string) $data['musicid']);
        if ($mid !== '') {
            $cookie = mc_qq_merge_cookies($cookie, 'uin=o' . str_pad($mid, 10, '0', STR_PAD_LEFT) . '; qqmusic_uin=' . $mid);
        }
    }
    $key = '';
    foreach (['musickey', 'key', 'qm_keyst'] as $k) {
        if (!empty($data[$k])) {
            $key = (string) $data[$k];
            break;
        }
    }
    if ($key !== '') {
        $cookie = mc_qq_merge_cookies($cookie, 'qm_keyst=' . $key . '; qqmusic_key=' . $key);
    }
    return $cookie;
}

/**
 * 扫码成功后：跟随 check_sig → authorize → QQLogin 换取音乐 Cookie
 */
function mc_qq_finish_qr_login($checkSigUrl, $qrsigCookie)
{
    $checkSigUrl = mc_qq_unescape_redirect_url($checkSigUrl);
    mc_qq_qr_debug('finish_start', [
        'url_host' => (string) (parse_url($checkSigUrl, PHP_URL_HOST) ?: ''),
        'url_path' => (string) (parse_url($checkSigUrl, PHP_URL_PATH) ?: ''),
        'url_len'  => strlen($checkSigUrl),
    ]);

    $followed = mc_qq_follow_collect($checkSigUrl, $qrsigCookie, 10, 'https://xui.ptlogin2.qq.com/');
    $cookie = $followed['cookie'];
    mc_qq_qr_debug('after_check_sig', [
        'hops'    => $followed['hops'],
        'cookies' => mc_qq_cookie_summary($cookie),
    ]);

    // 再访问 graph 登录跳转页，常能补齐 p_skey
    $jump = mc_qq_follow_collect(
        'https://graph.qq.com/oauth2.0/login_jump',
        $cookie,
        5,
        'https://xui.ptlogin2.qq.com/'
    );
    $cookie = $jump['cookie'];
    mc_qq_qr_debug('after_login_jump', [
        'hops'    => $jump['hops'],
        'cookies' => mc_qq_cookie_summary($cookie),
    ]);

    [$gtkKey, $gtkVal] = mc_qq_pick_gtk_key($cookie);
    if ($gtkVal === '') {
        // 兜底：部分环境仅有 superkey
        $gtkVal = mc_qq_cookie_get($cookie, 'superkey');
        $gtkKey = $gtkVal !== '' ? 'superkey' : '';
    }
    if ($gtkVal === '') {
        mc_qq_qr_debug('no_p_skey', array_merge(mc_qq_cookie_summary($cookie), [
            'note' => 'p_skey/skey empty after redirects',
        ]));
        // 仍尝试默认 g_tk，部分已带 pt_oauth_token 的会话可过
        $gtk = 5381;
        $gtkKey = 'default';
    } else {
        $gtk = mc_qq_gtk($gtkVal);
    }
    mc_qq_qr_debug('gtk_ready', [
        'from'    => $gtkKey,
        'gtk'     => $gtk,
        'key_len' => strlen($gtkVal),
    ]);

    $authBody = [
        'response_type' => 'code',
        'client_id'     => '100497308',
        'redirect_uri'  => 'https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/',
        'state'         => 'state',
        'switch'        => '',
        'from_ptlogin'  => '1',
        'src'           => '1',
        'update_auth'   => '1',
        'openapi'       => '1010',
        'g_tk'          => (string) $gtk,
        'auth_time'     => (string) time(),
        'ui'            => '',
    ];
    $auth = mc_qq_http('POST', 'https://graph.qq.com/oauth2.0/authorize', $authBody, $cookie, [
        'Referer: https://graph.qq.com/oauth2.0/login_jump',
    ]);
    $cookie = mc_qq_merge_cookies($cookie, $auth['cookies']);
    $loc = mc_qq_extract_location($auth['headers']);
    $code = mc_qq_extract_oauth_code($auth['headers'], $auth['body'], $loc);
    mc_qq_qr_debug('oauth_authorize', [
        'http'     => $auth['http'],
        'has_loc'  => $loc !== '',
        'has_code' => $code !== '',
        'code_len' => strlen($code),
        'cookies'  => mc_qq_cookie_summary($cookie),
    ]);

    if ($code === '' && $loc !== '') {
        $jump2 = mc_qq_follow_collect($loc, $cookie, 6, 'https://graph.qq.com/');
        $cookie = $jump2['cookie'];
        $last = $jump2['last'];
        $code = mc_qq_extract_oauth_code(
            $last ? $last['headers'] : '',
            $last ? $last['body'] : '',
            $loc
        );
        mc_qq_qr_debug('oauth_follow', [
            'hops'     => $jump2['hops'],
            'has_code' => $code !== '',
            'code_len' => strlen($code),
        ]);
    }

    // GET 方式再试一次 authorize（部分客户端用 query）
    if ($code === '') {
        $getUrl = 'https://graph.qq.com/oauth2.0/authorize?' . http_build_query($authBody);
        $authGet = mc_qq_http('GET', $getUrl, null, $cookie, [
            'Referer: https://graph.qq.com/oauth2.0/login_jump',
        ]);
        $cookie = mc_qq_merge_cookies($cookie, $authGet['cookies']);
        $loc2 = mc_qq_extract_location($authGet['headers']);
        $code = mc_qq_extract_oauth_code($authGet['headers'], $authGet['body'], $loc2);
        if ($code === '' && $loc2 !== '') {
            $j = mc_qq_follow_collect($loc2, $cookie, 6, 'https://graph.qq.com/');
            $cookie = $j['cookie'];
            $last = $j['last'];
            $code = mc_qq_extract_oauth_code($last ? $last['headers'] : '', $last ? $last['body'] : '', $loc2);
        }
        mc_qq_qr_debug('oauth_authorize_get', [
            'http'     => $authGet['http'],
            'has_code' => $code !== '',
            'code_len' => strlen($code),
        ]);
    }

    if ($code === '') {
        mc_qq_qr_debug('no_oauth_code', [
            'http'    => $auth['http'],
            'loc'     => $loc !== '' ? ((string) (parse_url($loc, PHP_URL_HOST) ?: '') . (string) (parse_url($loc, PHP_URL_PATH) ?: '')) : '',
            'cookies' => mc_qq_cookie_summary($cookie),
        ]);
        // Cookie 路径兜底：已有音乐 key 则直接校验
        if (mc_qq_has_music_key($cookie) && mc_qq_extract_uin($cookie) !== '') {
            $account = mc_qq_profile_validate($cookie);
            if ($account) {
                mc_qq_qr_debug('cookie_fallback_ok', ['uin' => $account['uin']]);
                return $account;
            }
        }
        return null;
    }

    $tryPayloads = [
        [
            'comm' => ['g_tk' => $gtk, 'platform' => 'yqq', 'ct' => 24, 'cv' => 0],
            'req'  => [
                'module' => 'QQConnectLogin.LoginServer',
                'method' => 'QQLogin',
                'param'  => ['code' => $code],
            ],
        ],
        [
            'comm'  => ['g_tk' => $gtk, 'platform' => 'yqq', 'ct' => 24, 'cv' => 0],
            'req_0' => [
                'module' => 'QQConnectLogin.LoginServer',
                'method' => 'QQLogin',
                'param'  => ['code' => $code],
            ],
        ],
    ];

    $loginJson = null;
    foreach ($tryPayloads as $idx => $payload) {
        $login = mc_qq_http(
            'POST',
            'https://u.y.qq.com/cgi-bin/musicu.fcg',
            json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            $cookie,
            ['Referer: https://y.qq.com/']
        );
        $cookie = mc_qq_merge_cookies($cookie, $login['cookies']);
        $loginJson = $login['json'];
        $data = null;
        if (is_array($loginJson)) {
            foreach (['req', 'req_0', 'req1', 'req0'] as $rk) {
                if (isset($loginJson[$rk]['data']) && is_array($loginJson[$rk]['data'])) {
                    $data = $loginJson[$rk]['data'];
                    break;
                }
            }
        }
        $hasKey = is_array($data) && (!empty($data['musickey']) || !empty($data['key']));
        mc_qq_qr_debug('musicu_qqlogin', [
            'variant'  => $idx,
            'http'     => $login['http'],
            'has_json' => is_array($loginJson),
            'has_key'  => $hasKey,
            'musicid'  => is_array($data) && !empty($data['musicid']),
            'ret'      => is_array($data) ? ($data['ret'] ?? ($data['code'] ?? null)) : null,
        ]);
        if ($hasKey) {
            $cookie = mc_qq_apply_music_login_data($cookie, $data);
            break;
        }
    }

    // 再扫一遍 JSON 任意节点里的 musickey
    if (!mc_qq_has_music_key($cookie) && is_array($loginJson)) {
        $stack = [$loginJson];
        while ($stack) {
            $node = array_pop($stack);
            if (!is_array($node)) {
                continue;
            }
            if (!empty($node['musickey']) || (!empty($node['musicid']) && !empty($node['key']))) {
                $cookie = mc_qq_apply_music_login_data($cookie, $node);
                break;
            }
            foreach ($node as $child) {
                if (is_array($child)) {
                    $stack[] = $child;
                }
            }
        }
    }

    $account = mc_qq_profile_validate($cookie);
    if (!$account) {
        mc_qq_qr_debug('validate_fail_after_qr', array_merge(mc_qq_cookie_summary($cookie), [
            'uin'     => mc_qq_extract_uin($cookie),
            'has_key' => mc_qq_has_music_key($cookie),
        ]));
    } else {
        mc_qq_qr_debug('finish_ok', ['uin' => $account['uin'], 'nick' => $account['nickname']]);
    }
    return $account;
}

function mc_qq_parse_ptui_cb($body)
{
    $body = (string) $body;
    // ptuiCB('0','0','url',...) 或双引号 / 混用
    if (!preg_match('/ptuiCB\s*\(\s*[\'"](\d+)[\'"]/', $body, $m)) {
        return null;
    }
    $code = (int) $m[1];
    $checkUrl = '';
    if ($code === 0) {
        if (preg_match('/ptuiCB\s*\(\s*[\'"]0[\'"]\s*,\s*[\'"][^\'"]*[\'"]\s*,\s*[\'"]([^\'"]+)[\'"]/', $body, $um)) {
            $checkUrl = mc_qq_unescape_redirect_url($um[1]);
        } elseif (preg_match('/https?:\\\\?\/\\\\?\/[^\'"\s]+check_sig[^\'"\s]*/', $body, $um)) {
            $checkUrl = mc_qq_unescape_redirect_url($um[0]);
        }
    }
    return ['code' => $code, 'checkUrl' => $checkUrl, 'raw' => $body];
}

function mc_qq_account_handle($action)
{
    switch ($action) {
        case 'qq_status':
            response(mc_qq_public_status(), 200, '');
            break;

        case 'qq_logout':
            mc_qq_auth_clear();
            @unlink(mc_qq_qr_session_file());
            response(['ok' => true], 200, '');
            break;

        case 'qq_cookie_save':
            $cookie = mc_qq_normalize_cookie(post('cookie'));
            if ($cookie === '') {
                response('', 400, '请粘贴 Cookie');
            }
            // 微信登录兼容
            $map = mc_qq_cookie_map($cookie);
            if (!empty($map['login_type']) && (int) $map['login_type'] === 2 && !empty($map['wxuin'])) {
                $cookie = mc_qq_merge_cookies($cookie, 'uin=' . $map['wxuin']);
            }
            $account = mc_qq_profile_validate($cookie);
            if (!$account) {
                response('', 401, 'Cookie 无效：需含 uin 与 qm_keyst/qqmusic_key，请从 y.qq.com 复制');
            }
            mc_qq_auth_write([
                'cookie'   => $account['cookie'],
                'uin'      => $account['uin'],
                'nickname' => $account['nickname'],
            ]);
            response(mc_qq_public_status(), 200, '');
            break;

        case 'qq_qr_key':
            $t = (string) mt_rand() / mt_getrandmax();
            $url = 'https://ssl.ptlogin2.qq.com/ptqrshow?' . http_build_query([
                'appid'       => '716027609',
                'e'           => '2',
                'l'           => 'M',
                's'           => '3',
                'd'           => '72',
                'v'           => '4',
                't'           => $t,
                'daid'        => '383',
                'pt_3rd_aid'  => '100497308',
                'u1'          => 'https://graph.qq.com/oauth2.0/login_jump',
            ]);
            $res = mc_qq_http('GET', $url, null, '', [
                'Referer: https://xui.ptlogin2.qq.com/',
            ]);
            $qrsig = mc_qq_cookie_get($res['cookies'], 'qrsig');
            if ($qrsig === '' || empty($res['body'])) {
                response('', 502, '无法获取 QQ 二维码，请改用 Cookie');
            }
            $ptqrtoken = mc_qq_hash33($qrsig);
            $img = base64_encode($res['body']);
            @file_put_contents(mc_qq_qr_session_file(), json_encode([
                'qrsig'     => $qrsig,
                'ptqrtoken' => $ptqrtoken,
                'createdAt' => time(),
            ], JSON_UNESCAPED_UNICODE));
            response([
                'qrimg' => 'data:image/png;base64,' . $img,
                'token' => substr(hash('sha256', $qrsig), 0, 16),
            ], 200, '');
            break;

        case 'qq_qr_check':
            $sessRaw = @file_get_contents(mc_qq_qr_session_file());
            $sess = $sessRaw ? json_decode($sessRaw, true) : null;
            if (!is_array($sess) || empty($sess['qrsig'])) {
                response('', 400, '二维码已失效，请刷新');
            }
            if (!empty($sess['finishFailed'])) {
                response([
                    'status'   => 0,
                    'loggedIn' => false,
                    'message'  => '扫码成功但换取音乐凭证失败，请刷新二维码或改用 Cookie',
                ], 502, '扫码成功但换取音乐凭证失败，请刷新二维码或改用 Cookie');
            }
            if (!empty($sess['finishing'])) {
                response([
                    'status'   => 67,
                    'message'  => '正在完成登录…',
                ], 200, '');
            }
            $qrsig = $sess['qrsig'];
            $ptqrtoken = (int) ($sess['ptqrtoken'] ?? mc_qq_hash33($qrsig));
            $url = 'https://ssl.ptlogin2.qq.com/ptqrlogin?' . http_build_query([
                'u1'          => 'https://graph.qq.com/oauth2.0/login_jump',
                'ptqrtoken'   => $ptqrtoken,
                'ptredirect'  => '0',
                'h'           => '1',
                't'           => '1',
                'g'           => '1',
                'from_ui'     => '1',
                'ptlang'      => '2052',
                'action'      => '0-0-' . (int) (microtime(true) * 1000),
                'js_ver'      => '20102616',
                'js_type'     => '1',
                'login_sig'   => '',
                'pt_uistyle'  => '40',
                'aid'         => '716027609',
                'daid'        => '383',
                'pt_3rd_aid'  => '100497308',
                'has_onekey'  => '1',
            ]);
            $res = mc_qq_http('GET', $url, null, 'qrsig=' . $qrsig, [
                'Referer: https://xui.ptlogin2.qq.com/',
            ]);
            $parsed = mc_qq_parse_ptui_cb((string) $res['body']);
            if (!$parsed) {
                mc_qq_qr_debug('ptui_parse_fail', [
                    'http' => $res['http'],
                    'body_preview' => substr(preg_replace('/\s+/', ' ', (string) $res['body']), 0, 180),
                ]);
                response(['status' => -1, 'message' => '轮询异常'], 200, '');
            }
            $code = (int) $parsed['code'];
            $payload = ['status' => $code, 'message' => ''];
            // 66 待扫 67 已扫 65 过期 0 成功
            if ($code === 66) {
                $payload['message'] = '等待扫码…';
            } elseif ($code === 67) {
                $payload['message'] = '已扫码，请在手机上确认';
            } elseif ($code === 65) {
                $payload['message'] = '二维码已过期，请刷新';
            } elseif ($code === 0) {
                $checkUrl = $parsed['checkUrl'];
                mc_qq_qr_debug('ptui_ok', [
                    'has_url'  => $checkUrl !== '',
                    'url_host' => $checkUrl !== '' ? (string) (parse_url($checkUrl, PHP_URL_HOST) ?: '') : '',
                    'url_len'  => strlen($checkUrl),
                ]);
                if ($checkUrl === '') {
                    response(array_merge($payload, ['loggedIn' => false]), 502, '登录成功但缺少跳转地址，请改用 Cookie');
                }
                // 防止轮询重复消耗一次性 check_sig
                $sess['finishing'] = true;
                @file_put_contents(mc_qq_qr_session_file(), json_encode($sess, JSON_UNESCAPED_UNICODE));
                $account = mc_qq_finish_qr_login($checkUrl, mc_qq_merge_cookies('qrsig=' . $qrsig, $res['cookies']));
                if (!$account) {
                    $sess['finishFailed'] = true;
                    unset($sess['finishing']);
                    @file_put_contents(mc_qq_qr_session_file(), json_encode($sess, JSON_UNESCAPED_UNICODE));
                    response(array_merge($payload, [
                        'loggedIn' => false,
                        'message'  => '扫码成功但换取音乐凭证失败，请刷新二维码或改用 Cookie',
                    ]), 502, '扫码成功但换取音乐凭证失败，请刷新二维码或改用 Cookie');
                }
                mc_qq_auth_write([
                    'cookie'   => $account['cookie'],
                    'uin'      => $account['uin'],
                    'nickname' => $account['nickname'],
                ]);
                @unlink(mc_qq_qr_session_file());
                $payload['loggedIn'] = true;
                $payload['uin'] = $account['uin'];
                $payload['nickname'] = $account['nickname'];
                $payload['message'] = '登录成功';
            }
            response($payload, 200, '');
            break;

        case 'qq_playlists':
            $auth = mc_qq_auth_read();
            if (!$auth) {
                response('', 401, '请先登录 QQ 音乐');
            }
            $list = mc_qq_fetch_playlists($auth['uin'], $auth['cookie']);
            response(['playlists' => $list], 200, '');
            break;

        case 'qq_likelist':
            $auth = mc_qq_auth_read();
            if (!$auth) {
                response('', 401, '请先登录 QQ 音乐');
            }
            $list = mc_qq_fetch_playlists($auth['uin'], $auth['cookie']);
            $likedId = '';
            foreach ($list as $pl) {
                if ((int) ($pl['dirid'] ?? 0) === 201) {
                    $likedId = $pl['id'];
                    break;
                }
            }
            if ($likedId === '') {
                response([
                    'playlistId' => '',
                    'tracks'     => [],
                    'name'       => '我喜欢',
                    'total'      => 0,
                ], 200, '');
            }
            $tracks = mc_qq_playlist_tracks($likedId, $auth['cookie']);
            response([
                'playlistId' => $likedId,
                'name'       => '我喜欢',
                'tracks'     => $tracks,
                'total'      => count($tracks),
            ], 200, '');
            break;

        case 'qq_playlist_detail':
            $auth = mc_qq_auth_read();
            if (!$auth) {
                response('', 401, '请先登录 QQ 音乐');
            }
            $id = trim((string) post('id'));
            if ($id === '' || !preg_match('/^\d+$/', $id)) {
                response('', 400, '歌单 ID 无效');
            }
            $tracks = mc_qq_playlist_tracks($id, $auth['cookie']);
            $name = '';
            $meta = mc_qq_http('GET', 'https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?' . http_build_query([
                'type'    => 1,
                'utf8'    => 1,
                'disstid' => $id,
                'format'  => 'json',
            ]), null, $auth['cookie']);
            if (!empty($meta['json']['cdlist'][0]['dissname'])) {
                $name = (string) $meta['json']['cdlist'][0]['dissname'];
            }
            response([
                'id'     => $id,
                'name'   => $name,
                'tracks' => $tracks,
                'total'  => count($tracks),
            ], 200, '');
            break;

        default:
            response('', 400, '未知操作');
    }
}
