<?php
/**
 *
 * 音乐搜索器 - 函数声明
 *
 * @author  MaiCong <i@maicong.me>
 * @link    https://github.com/maicong/music
 * @since   1.6.2
 *
 */

// 非我族类
if (!defined('MC_CORE')) {
    header("Location: /");
    exit();
}

// 显示 PHP 错误报告
error_reporting(MC_DEBUG);

// 引入 Curl
require MC_CORE_DIR . '/vendor/autoload.php';

// 使用 Curl
use \Curl\Curl;

// 未配置显式代理时，清除继承的代理环境变量，避免 libcurl 自动走 Clash/VPN 系统代理
if (!defined('MC_PROXY') || !MC_PROXY) {
    foreach ([
        'http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY',
        'all_proxy', 'ALL_PROXY', 'socks_proxy', 'SOCKS_PROXY',
        'socks5_proxy', 'SOCKS5_PROXY', 'ftp_proxy', 'FTP_PROXY',
    ] as $mc_proxy_env) {
        putenv($mc_proxy_env);
        unset($_ENV[$mc_proxy_env], $_SERVER[$mc_proxy_env]);
    }
    putenv('NO_PROXY=*');
    putenv('no_proxy=*');
    $_ENV['NO_PROXY'] = '*';
    $_ENV['no_proxy'] = '*';
    $_SERVER['NO_PROXY'] = '*';
    $_SERVER['no_proxy'] = '*';
}

/**
 * curl 直连选项：空 PROXY 禁用环境变量代理，NOPROXY=* 兜底。
 * 显式 MC_PROXY 时不要合并此数组。
 */
function mc_curl_direct_opts()
{
    $opts = [
        CURLOPT_PROXY => '',
    ];
    if (defined('CURLOPT_NOPROXY')) {
        $opts[CURLOPT_NOPROXY] = '*';
    }
    return $opts;
}

// Clash fake-ip 常用网段 198.18.0.0/15，解析到此后直连 TLS 常失败
function mc_is_fake_ip($ip)
{
    if (!$ip || !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
        return false;
    }
    $long = ip2long($ip);
    return ($long & 0xFFFE0000) === (ip2long('198.18.0.0') & 0xFFFE0000);
}

// 通过 DoH 解析真实 IP（绕过系统 fake-ip DNS）
function mc_doh_resolve($host)
{
    static $cache = [];
    $host = strtolower(trim($host));
    if ($host === '' || filter_var($host, FILTER_VALIDATE_IP)) {
        return $host !== '' ? $host : null;
    }
    if (array_key_exists($host, $cache)) {
        return $cache[$host];
    }

    // DoH 服务自身也常被 fake-ip，这里固定解析到已知地址
    $endpoints = [
        [
            'url'     => 'https://dns.alidns.com/resolve?name=' . rawurlencode($host) . '&type=A',
            'resolve' => ['dns.alidns.com:443:223.5.5.5', 'dns.alidns.com:443:223.6.6.6'],
        ],
        [
            'url'     => 'https://cloudflare-dns.com/dns-query?name=' . rawurlencode($host) . '&type=A',
            'resolve' => ['cloudflare-dns.com:443:1.1.1.1', 'cloudflare-dns.com:443:1.0.0.1'],
        ],
    ];
    foreach ($endpoints as $endpoint) {
        $ch = curl_init($endpoint['url']);
        curl_setopt_array($ch, mc_curl_direct_opts() + [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 5,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_HTTPHEADER     => ['Accept: application/dns-json'],
            CURLOPT_USERAGENT      => 'RyanMusic/1.0',
            CURLOPT_RESOLVE        => $endpoint['resolve'],
        ]);
        $raw = curl_exec($ch);
        curl_close($ch);
        $json = json_decode($raw, true);
        if (empty($json['Answer']) || !is_array($json['Answer'])) {
            continue;
        }
        foreach ($json['Answer'] as $ans) {
            $type = isset($ans['type']) ? (int) $ans['type'] : 0;
            $data = isset($ans['data']) ? trim($ans['data']) : '';
            if ($type === 1 && filter_var($data, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) && !mc_is_fake_ip($data)) {
                return $cache[$host] = $data;
            }
        }
    }

    return $cache[$host] = null;
}

// 系统 DNS 若落到 fake-ip，则改用 DoH 真实 IP
function mc_resolve_host($host)
{
    static $cache = [];
    $host = strtolower(trim($host));
    if ($host === '') {
        return null;
    }
    if (filter_var($host, FILTER_VALIDATE_IP)) {
        return $host;
    }
    if (array_key_exists($host, $cache)) {
        return $cache[$host];
    }

    $ips = @gethostbynamel($host);
    if (is_array($ips)) {
        foreach ($ips as $ip) {
            if ($ip && !mc_is_fake_ip($ip)) {
                return $cache[$host] = $ip;
            }
        }
    }

    $doh = mc_doh_resolve($host);
    return $cache[$host] = $doh;
}

// 生成 CURLOPT_RESOLVE 列表；仅在需要绕过 fake-ip 时返回
function mc_curl_resolve_list($url)
{
    $parts = @parse_url($url);
    if (empty($parts['host'])) {
        return [];
    }
    $host = strtolower($parts['host']);
    if (filter_var($host, FILTER_VALIDATE_IP)) {
        return [];
    }

    $sys = @gethostbyname($host);
    if ($sys && $sys !== $host && !mc_is_fake_ip($sys)) {
        return [];
    }

    $ip = mc_resolve_host($host);
    if (!$ip || mc_is_fake_ip($ip)) {
        return [];
    }

    $scheme = isset($parts['scheme']) ? strtolower($parts['scheme']) : 'http';
    $port = isset($parts['port'])
        ? (int) $parts['port']
        : ($scheme === 'https' ? 443 : 80);

    return [
        $host . ':' . $port . ':' . $ip,
        // 跟随同域跳转时常见双端口
        $host . ':443:' . $ip,
        $host . ':80:' . $ip,
    ];
}

function mc_curl_apply_resolve($ch, $url)
{
    $list = mc_curl_resolve_list($url);
    if ($list) {
        curl_setopt($ch, CURLOPT_RESOLVE, $list);
    }
    return $list;
}

// Curl 内容获取
function mc_curl($args = [])
{
    $default = [
        'method'     => 'GET',
        'user-agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.50 Safari/537.36',
        'url'        => null,
        'referer'    => 'https://www.google.co.uk',
        'headers'    => null,
        'body'       => null,
        'proxy'      => false
    ];
    $args         = array_merge($default, $args);
    $method       = mb_strtolower($args['method']);
    $method_allow = ['get', 'post'];
    if (null === $args['url'] || !in_array($method, $method_allow, true)) {
        return;
    }
    $curl = new Curl();
    $curl->setUserAgent($args['user-agent']);
    $curl->setReferrer($args['referer']);
    $curl->setTimeout(15);
    $curl->setHeader('X-Requested-With', 'XMLHttpRequest');
    $curl->setOpt(CURLOPT_FOLLOWLOCATION, true);
    $curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
    $curl->setOpt(CURLOPT_SSL_VERIFYHOST, false);
    $resolve = mc_curl_resolve_list($args['url']);
    if ($resolve) {
        $curl->setOpt(CURLOPT_RESOLVE, $resolve);
    }
    if ($args['proxy'] && MC_PROXY) {
        $curl->setOpt(CURLOPT_HTTPPROXYTUNNEL, 1);
        $curl->setOpt(CURLOPT_PROXY, MC_PROXY);
        $curl->setOpt(CURLOPT_PROXYUSERPWD, MC_PROXYUSERPWD);
    } else {
        // 默认直连，忽略 Clash/VPN 注入的 http_proxy 等环境变量
        $curl->setOpt(CURLOPT_PROXY, '');
        if (defined('CURLOPT_NOPROXY')) {
            $curl->setOpt(CURLOPT_NOPROXY, '*');
        }
    }
    if (!empty($args['headers'])) {
        $curl->setHeaders($args['headers']);
    }
    $curl->$method($args['url'], $args['body']);
    $curl->close();
    if (!$curl->error) {
        return $curl->rawResponse;
    }
}

// 代理流式下载（解决跨域无法直接 download 的问题）
function mc_stream_download($url, $filename)
{
    if (!preg_match('#^https?://#i', $url)) {
        return false;
    }

    $referer = 'https://y.qq.com/';
    if (preg_match('#(163\.com|126\.net|netease)#i', $url)) {
        $referer = 'https://music.163.com/';
    } elseif (preg_match('#myhkw\.cn#i', $url)) {
        $referer = 'https://s.myhkw.cn/';
    }

    if (headers_sent()) {
        return false;
    }

    header('Content-Type: application/octet-stream');
    header(
        "Content-Disposition: attachment; filename=\"download.mp3\"; filename*=UTF-8''" .
        rawurlencode($filename)
    );
    header('Cache-Control: no-store, no-cache, must-revalidate');
    header('Pragma: no-cache');

    $ch = curl_init($url);
    $opts = [
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 5,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        CURLOPT_REFERER        => $referer,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_TIMEOUT        => 300,
        CURLOPT_CONNECTTIMEOUT => 20,
        CURLOPT_HEADER         => false,
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_WRITEFUNCTION  => function ($curl, $chunk) {
            echo $chunk;
            if (function_exists('ob_flush')) {
                @ob_flush();
            }
            flush();
            return strlen($chunk);
        },
    ];
    $resolve = mc_curl_resolve_list($url);
    if ($resolve) {
        $opts[CURLOPT_RESOLVE] = $resolve;
    }
    if (MC_PROXY) {
        $opts[CURLOPT_HTTPPROXYTUNNEL] = 1;
        $opts[CURLOPT_PROXY] = MC_PROXY;
        $opts[CURLOPT_PROXYUSERPWD] = MC_PROXYUSERPWD;
    } else {
        $opts += mc_curl_direct_opts();
    }
    curl_setopt_array($ch, $opts);
    $ok = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return $ok && $code >= 200 && $code < 400;
}

function mc_media_referer($url)
{
    if (preg_match('#(163\.com|126\.net|netease)#i', $url)) {
        return 'https://music.163.com/';
    }
    if (preg_match('#myhkw\.cn#i', $url)) {
        return 'https://s.myhkw.cn/';
    }
    return 'https://y.qq.com/';
}

/**
 * 同源流式代理（支持 Range），便于 <audio> 分析频谱且不跨域静音。
 */
function mc_proxy_stream($url, $options = [])
{
    if (!preg_match('#^https?://#i', $url) || headers_sent()) {
        return false;
    }

    $as_download = !empty($options['download']);
    $filename = isset($options['filename']) ? $options['filename'] : 'RyanMusic.mp3';
    $default_type = isset($options['content_type']) ? $options['content_type'] : 'audio/mpeg';
    $referer = mc_media_referer($url);
    $range = isset($_SERVER['HTTP_RANGE']) ? trim($_SERVER['HTTP_RANGE']) : '';

    $status_code = 200;
    $resp_headers = [];
    $headers_sent_flag = false;

    $req_headers = [
        'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer: ' . $referer,
        'Accept: */*',
    ];
    if ($range !== '') {
        $req_headers[] = 'Range: ' . $range;
    }

    @ini_set('zlib.output_compression', '0');
    if (function_exists('apache_setenv')) {
        @apache_setenv('no-gzip', '1');
    }
    while (ob_get_level() > 0) {
        @ob_end_clean();
    }

    $ch = curl_init($url);
    $opts = [
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 5,
        CURLOPT_HTTPHEADER     => $req_headers,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_TIMEOUT        => 300,
        CURLOPT_CONNECTTIMEOUT => 20,
        CURLOPT_RETURNTRANSFER => false,
    ];
    $resolve = mc_curl_resolve_list($url);
    if ($resolve) {
        $opts[CURLOPT_RESOLVE] = $resolve;
    }
    $opts += [
        CURLOPT_HEADERFUNCTION => function ($curl, $header_line) use (&$status_code, &$resp_headers) {
            if (preg_match('/^HTTP\/\S+\s+(\d+)/i', $header_line, $m)) {
                $status_code = (int) $m[1];
                $resp_headers = [];
            } elseif (preg_match('/^([^:]+):\s*(.+)$/', trim($header_line), $m)) {
                $resp_headers[strtolower(trim($m[1]))] = trim($m[2]);
            }
            return strlen($header_line);
        },
        CURLOPT_WRITEFUNCTION => function ($curl, $chunk) use (
            &$headers_sent_flag,
            &$status_code,
            &$resp_headers,
            $as_download,
            $filename,
            $default_type
        ) {
            if (!$headers_sent_flag) {
                $headers_sent_flag = true;
                http_response_code($status_code >= 100 ? $status_code : 200);
                $ctype = isset($resp_headers['content-type']) ? $resp_headers['content-type'] : $default_type;
                header('Content-Type: ' . $ctype);
                header('Cache-Control: no-store');
                header('Accept-Ranges: bytes');
                if (isset($resp_headers['content-length'])) {
                    header('Content-Length: ' . $resp_headers['content-length']);
                }
                if (isset($resp_headers['content-range'])) {
                    header('Content-Range: ' . $resp_headers['content-range']);
                }
                if ($as_download) {
                    header(
                        'Content-Disposition: attachment; filename="' .
                        str_replace('"', '', $filename) .
                        '"; filename*=UTF-8\'\'' .
                        rawurlencode($filename)
                    );
                }
            }
            echo $chunk;
            if (function_exists('ob_flush')) {
                @ob_flush();
            }
            flush();
            return strlen($chunk);
        },
    ];
    if (MC_PROXY) {
        $opts[CURLOPT_HTTPPROXYTUNNEL] = 1;
        $opts[CURLOPT_PROXY] = MC_PROXY;
        $opts[CURLOPT_PROXYUSERPWD] = MC_PROXYUSERPWD;
    } else {
        $opts += mc_curl_direct_opts();
    }
    curl_setopt_array($ch, $opts);
    $ok = curl_exec($ch);
    curl_close($ch);
    return (bool) $ok;
}

// 判断地址是否明显无效（不要用 HEAD 探测 CDN，很多音源不支持 HEAD）
function mc_is_error($url) {
    if (!$url || !is_string($url)) {
        return true;
    }
    if (!preg_match('#^https?://#i', $url)) {
        return true;
    }
    if (stripos($url, '/404') !== false || stripos($url, 'music.163.com/404') !== false) {
        return true;
    }
    return false;
}

// 获取明月浩空维护版生成的短时签名资源地址。
// 原版 QQ 直链接口已大量失效，这里仅作为本地学习调试的兼容回退。
function mc_get_myhkw_song($songid, $site)
{
    if (!$songid || !$site) {
        return;
    }
    $result = mc_curl([
        'method'  => 'POST',
        'url'     => 'https://s.myhkw.cn/',
        'referer' => 'https://s.myhkw.cn/',
        'headers' => [
            'Origin' => 'https://s.myhkw.cn',
            'Content-Type' => 'application/x-www-form-urlencoded; charset=UTF-8'
        ],
        'body'    => [
            'input'  => $songid,
            'filter' => 'id',
            'type'   => $site,
            'page'   => 1
        ]
    ]);
    $json = json_decode($result, true);
    if (empty($json['data'][0])) {
        return;
    }
    return $json['data'][0];
}

function mc_set_response_meta($key, $value)
{
    if (!isset($GLOBALS['MC_RESPONSE_META']) || !is_array($GLOBALS['MC_RESPONSE_META'])) {
        $GLOBALS['MC_RESPONSE_META'] = [];
    }
    $GLOBALS['MC_RESPONSE_META'][$key] = $value;
}

function mc_name_search_source_page($page)
{
    $page = (int) $page;
    if ($page < 1) {
        $page = 1;
    }
    return $page;
}

function mc_slice_name_search_songids($songids, $page)
{
    if (!is_array($songids)) {
        return [
            'songids' => [],
            'has_more' => false,
        ];
    }

    $limit = 10;
    $slice = array_values(array_slice($songids, 0, $limit));

    return [
        'songids' => $slice,
        'has_more' => count($songids) >= $limit,
    ];
}

// 音频数据接口地址
function mc_song_urls($value, $type = 'query', $site = 'netease', $page = 1)
{
    if (!$value) {
        return;
    }
    $query             = ('query' === $type) ? $value : '';
    $songid            = ('songid' === $type || 'lrc' === $type) ? $value : '';
    $radio_search_urls = [
        'netease'            => [
            'method'         => 'POST',
            'url'            => 'http://music.163.com/api/linux/forward',
            'referer'        => 'http://music.163.com/',
            'proxy'          => false,
            'body'           => encode_netease_data([
                'method'     => 'POST',
                'url'        => 'http://music.163.com/api/cloudsearch/pc',
                'params'     => [
                    's'      => $query,
                    'type'   => 1,
                    'offset' => $page * 10 - 10,
                    'limit'  => 10
                ]
            ])
        ],
        '1ting'              => [
            'method'         => 'GET',
            'url'            => 'http://so.1ting.com/song/json',
            'referer'        => 'http://h5.1ting.com/',
            'proxy'          => false,
            'body'           => [
                'q'          => $query,
                'page'       => $page,
                'size'       => 10
            ]
        ],
        'baidu'              => [
            'method'         => 'GET',
            'url'            => 'http://musicapi.qianqian.com/v1/restserver/ting',
            'referer'        => 'http://music.baidu.com/',
            'proxy'          => false,
            'body'           => [
                'method'    => 'baidu.ting.search.common',
                'query'     => $query,
                'format'    => 'json',
                'page_no'   => $page,
                'page_size' => 10
            ]
        ],
        'kugou'              => [
            'method'         => 'GET',
            'url'            => MC_INTERNAL ?
                'http://songsearch.kugou.com/song_search_v2' :
                'http://mobilecdn.kugou.com/api/v3/search/song',
            'referer'        => MC_INTERNAL ? 'http://www.kugou.com' : 'http://m.kugou.com',
            'proxy'          => false,
            'body'           => [
                'keyword'    => $query,
                'platform'   => 'WebFilter',
                'format'     => 'json',
                'page'       => $page,
                'pagesize'   => 10
            ]
        ],
        'kuwo'               => [
            'method'         => 'GET',
            'url'            => 'http://search.kuwo.cn/r.s',
            'referer'        => 'http://player.kuwo.cn/webmusic/play',
            'proxy'          => false,
            'body'           => [
                'all'        => $query,
                'ft'         => 'music',
                'itemset'    => 'web_2013',
                'pn'         => $page - 1,
                'rn'         => 10,
                'rformat'    => 'json',
                'encoding'   => 'utf8'
            ]
        ],
        'qq'                 => [
            'method'         => 'GET',
            'url'            => 'http://c.y.qq.com/soso/fcgi-bin/search_for_qq_cp',
            'referer'        => 'http://m.y.qq.com',
            'proxy'          => false,
            'body'           => [
                'w'          => $query,
                'p'          => $page,
                'n'          => 10,
                'format'     => 'json'
            ],
            'user-agent'     => 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1'
        ],
        'xiami'              => [
            'method'         => 'GET',
            'url'            => 'http://api.xiami.com/web',
            'referer'        => 'http://m.xiami.com',
            'proxy'          => false,
            'body'           => [
                'key'        => $query,
                'v'          => '2.0',
                'app_key'    => '1',
                'r'          => 'search/songs',
                'page'       => $page,
                'limit'      => 10
            ],
            'user-agent'     => 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1'
        ],
        '5singyc'            => [
            'method'         => 'GET',
            'url'            => 'http://goapi.5sing.kugou.com/search/search',
            'referer'        => 'http://5sing.kugou.com/',
            'proxy'          => false,
            'body'           => [
                'k'          => $query,
                't'          => '0',
                'filterType' => '1',
                'ps'         => 10,
                'pn'         => $page
            ]
        ],
        '5singfc'            => [
            'method'         => 'GET',
            'url'            => 'http://goapi.5sing.kugou.com/search/search',
            'referer'        => 'http://5sing.kugou.com/',
            'proxy'          => false,
            'body'           => [
                'k'          => $query,
                't'          => '0',
                'filterType' => '2',
                'ps'         => 10,
                'pn'         => 1
            ]
        ],
        'migu'               => [
            'method'         => 'GET',
            'url'            => 'http://m.10086.cn/migu/remoting/scr_search_tag',
            'referer'        => 'http://m.10086.cn',
            'proxy'          => false,
            'body'           => [
                'keyword'    => $query,
                'type'       => '2',
                'pgc'        => $page,
                'rows'       => 10
            ],
            'user-agent'    => 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1'
        ],
        'lizhi'              => [
            'method'         => 'GET',
            'url'            => 'http://m.lizhi.fm/api/search_audio/' . urlencode($query) . '/' . $page,
            'referer'        => 'http://m.lizhi.fm',
            'proxy'          => false,
            'body'           => false,
            'user-agent'     => 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1'
        ],
        'qingting'           => [
            'method'         => 'GET',
            'url'            => 'http://i.qingting.fm/wapi/search',
            'referer'        => 'http://www.qingting.fm',
            'proxy'          => false,
            'body'           => [
                'k'          => $query,
                'page'       => $page,
                'pagesize'   => 10,
                'include'    => 'program_ondemand',
                'groups'     => 'program_ondemand'
            ]
        ],
        'ximalaya'           => [
            'method'         => 'GET',
            'url'            => 'http://search.ximalaya.com/front/v1',
            'referer'        => 'http://www.ximalaya.com',
            'proxy'          => false,
            'body'           => [
                'kw'         => $query,
                'core'       => 'all',
                'page'       => $page,
                'rows'       => 10,
                'is_paid'    => false
            ]
        ],
        'kg'                 => [
            'method'         => 'GET',
            'url'            => 'http://kg.qq.com/cgi/kg_ugc_get_homepage',
            'referer'        => 'http://kg.qq.com',
            'proxy'          => false,
            'body'           => [
                'format'     => 'json',
                'type'       => 'get_ugc',
                'inCharset'  => 'utf8',
                'outCharset' => 'utf-8',
                'share_uid'  => $query,
                'start'      => $page,
                'num'        => 10
            ]
        ]
    ];
    $radio_song_urls = [
        'netease'           => [
            'method'        => 'POST',
            'url'           => 'http://music.163.com/api/linux/forward',
            'referer'       => 'http://music.163.com/',
            'proxy'         => false,
            'body'          => encode_netease_data([
                'method'    => 'GET',
                'url'       => 'http://music.163.com/api/song/detail',
                'params'    => [
                  'id'      => $songid,
                  'ids'     => '[' . $songid . ']'
                ]
            ])
        ],
        '1ting'             => [
            'method'        => 'GET',
            'url'           => 'http://h5.1ting.com/touch/api/song',
            'referer'       => 'http://h5.1ting.com/#/song/' . $songid,
            'proxy'         => false,
            'body'          => [
                'ids'       => $songid
            ]
        ],
        'baidu'             => [
            'method'        => 'GET',
            'url'           => 'http://music.baidu.com/data/music/links',
            'referer'       => 'music.baidu.com/song/' . $songid,
            'proxy'         => false,
            'body'          => [
                'songIds'   => $songid
            ]
        ],
        'kugou'             => [
            'method'        => 'GET',
            'url'           => 'http://m.kugou.com/app/i/getSongInfo.php',
            'referer'       => 'http://m.kugou.com/play/info/' . $songid,
            'proxy'         => false,
            'body'          => [
                'cmd'       => 'playInfo',
                'hash'      => $songid
            ],
            'user-agent'    => 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1'
        ],
        'kuwo'              => [
            'method'        => 'GET',
            'url'           => 'http://player.kuwo.cn/webmusic/st/getNewMuiseByRid',
            'referer'       => 'http://player.kuwo.cn/webmusic/play',
            'proxy'         => false,
            'body'          => [
                'rid'       => 'MUSIC_' . $songid
            ]
        ],
        'qq'                => [
            'method'        => 'GET',
            'url'           => 'http://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg',
            'referer'       => 'http://m.y.qq.com',
            'proxy'         => false,
            'body'          => [
                'songmid'   => $songid,
                'format'    => 'json'
            ],
            'user-agent'    => 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1'
        ],
        'xiami'             => [
            'method'        => 'GET',
            'url'           => 'http://www.xiami.com/song/playlist/id/' . $songid . '/type/0/cat/json',
            'referer'       => 'http://www.xiami.com',
            'proxy'         => false
        ],
        '5singyc'           => [
            'method'        => 'GET',
            'url'           => 'http://mobileapi.5sing.kugou.com/song/newget',
            'referer'       => 'http://5sing.kugou.com/yc/' . $songid . '.html',
            'proxy'         => false,
            'body'          => [
                'songid'    => $songid,
                'songtype'  => 'yc'
            ]
        ],
        '5singfc'           => [
            'method'        => 'GET',
            'url'           => 'http://mobileapi.5sing.kugou.com/song/newget',
            'referer'       => 'http://5sing.kugou.com/fc/' . $songid . '.html',
            'proxy'         => false,
            'body'          => [
                'songid'    => $songid,
                'songtype'  => 'fc'
            ]
        ],
        'migu'              => [
            'method'        => 'GET',
            'url'           => MC_INTERNAL ? 'http://music.migu.cn/v2/async/audioplayer/playurl/' . $songid : 'http://m.10086.cn/migu/remoting/cms_detail_tag',
            'referer'       => 'http://m.10086.cn',
            'proxy'         => false,
            'body'          => MC_INTERNAL ? false : [
                'cid'    => $songid
            ],
            'user-agent'    => 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1'
        ],
        'lizhi'             => [
            'method'        => 'GET',
            'url'           => 'http://m.lizhi.fm/api/audios_with_radio',
            'referer'       => 'http://m.lizhi.fm',
            'proxy'         => false,
            'body'          => false,
            'user-agent'    => 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1'
        ],
        'qingting'          => [
            'method'        => 'GET',
            'url'           => 'http://i.qingting.fm/wapi/channels/' . split_songid($songid, 0) . '/programs/' . split_songid($songid, 1),
            'referer'       => 'http://www.qingting.fm',
            'proxy'         => false,
            'body'          => false
        ],
        'ximalaya'          => [
            'method'        => 'GET',
            'url'           => 'http://mobile.ximalaya.com/v1/track/ca/playpage/' . $songid,
            'referer'       => 'http://www.ximalaya.com',
            'proxy'         => false,
            'body'          => false
        ],
        'kg'                => [
            'method'        => 'GET',
            'url'           => 'http://kg.qq.com/cgi/kg_ugc_getdetail',
            'referer'       => 'http://kg.qq.com',
            'proxy'         => false,
            'body'          => [
                'v'          => 4,
                'format'     => 'json',
                'inCharset'  => 'utf8',
                'outCharset' => 'utf-8',
                'shareid'    => $songid
            ]
        ]
    ];
    $radio_lrc_urls = [
        'netease'           => [
            'method'        => 'POST',
            'url'           => 'http://music.163.com/api/linux/forward',
            'referer'       => 'http://music.163.com/',
            'proxy'         => false,
            'body'          => encode_netease_data([
                'method'    => 'GET',
                'url'       => 'http://music.163.com/api/song/lyric',
                'params'    => [
                  'id' => $songid,
                  'lv' => -1,
                  'tv' => -1,
                  'rv' => -1,
                  'kv' => -1,
                  'yv' => -1
                ]
            ])
        ],
        '1ting'             => [
            'method'        => 'GET',
            'url'           => 'http://www.1ting.com/api/geci/lrc/' . $songid,
            'referer'       => 'http://www.1ting.com/geci' . $songid . '.html',
            'proxy'         => false,
            'body'          => false
        ],
        'baidu'             => [
            'method'        => 'GET',
            'url'           => 'http://musicapi.qianqian.com/v1/restserver/ting',
            'referer'       => 'http://music.baidu.com/song/' . $songid,
            'proxy'         => false,
            'body'          => [
                'method' => 'baidu.ting.song.lry',
                'songid' => $songid,
                'format' => 'json'
            ]
        ],
        'kugou'             => [
            'method'        => 'GET',
            'url'           => 'http://m.kugou.com/app/i/krc.php',
            'referer'       => 'http://m.kugou.com/play/info/' . $songid,
            'proxy'         => false,
            'body'          => [
                'cmd'        => 100,
                'timelength' => 999999,
                'hash'       => $songid
            ],
            'user-agent'    => 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X] AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1'
        ],
        'kuwo'              => [
            'method'        => 'GET',
            'url'           => 'http://m.kuwo.cn/newh5/singles/songinfoandlrc',
            'referer'       => 'http://m.kuwo.cn/yinyue/' . $songid,
            'proxy'         => false,
            'body'          => [
                'musicId' => $songid
            ],
            'user-agent'    => 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1'
        ],
        'qq'                => [
            'method'        => 'GET',
            'url'           => 'http://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric.fcg',
            'referer'       => 'http://m.y.qq.com',
            'proxy'         => false,
            'body'          => [
                'songmid'   => $songid,
                'format'    => 'json',
                'nobase64'  => 1,
                'songtype'  => 0,
                'callback'  => 'c'
            ],
            'user-agent'    => 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1'
        ],
        'xiami'             => [
            'method'        => 'GET',
            'url'           => $songid,
            'referer'       => 'http://www.xiami.com',
            'proxy'         => false
        ],
        'kg'                => [
            'method'        => 'GET',
            'url'           => 'http://kg.qq.com/cgi/fcg_lyric',
            'referer'       => 'http://kg.qq.com',
            'proxy'         => false,
            'body'          => [
                'format'     => 'json',
                'inCharset'  => 'utf8',
                'outCharset' => 'utf-8',
                'ksongmid'   => $songid
            ]
        ]
    ];
    if ('query' === $type) {
        return $radio_search_urls[$site];
    }
    if ('songid' === $type) {
        return $radio_song_urls[$site];
    }
    if ('lrc' === $type) {
        return $radio_lrc_urls[$site];
    }
    return;
}

// 获取音频信息 - 关键词搜索
function mc_get_song_by_name($query, $site = 'netease', $page = 1)
{
    if (!$query) {
        return;
    }
    $radio_search_url = mc_song_urls($query, 'query', $site, mc_name_search_source_page($page));
    if (empty($query) || empty($radio_search_url)) {
        return;
    }
    $radio_result = mc_curl($radio_search_url);
    if (empty($radio_result)) {
        return;
    }
    $radio_songid = [];
    switch ($site) {
        case '1ting':
            $radio_data = json_decode($radio_result, true);
            if (empty($radio_data['results'])) {
                return;
            }
            foreach ($radio_data['results'] as $val) {
                $radio_songid[] = $val['song_id'];
            }
            break;
        case 'baidu':
            $radio_data = json_decode($radio_result, true);
            if (empty($radio_data['song_list'])) {
                return;
            }
            foreach ($radio_data['song_list'] as $val) {
                $radio_songid[] = $val['song_id'];
            }
            break;
        case 'kugou':
            $radio_data = json_decode($radio_result, true);
            $key = MC_INTERNAL ? 'lists' : 'info';
            if (empty($radio_data['data']) || empty($radio_data['data'][$key])) {
                return;
            }
            foreach ($radio_data['data'][$key] as $val) {
                if (MC_INTERNAL) {
                    $hash = $val['SQFileHash'];
                    if (!str_replace('0', '', $hash)) {
                        $hash = $val['FileHash'];
                    }
                } else {
                    $hash = $val['320hash'] ?: $val['hash'];
                }
                $radio_songid[] = $hash;
            }
            break;
        case 'kuwo':
            $radio_result = str_replace('\'', '"', $radio_result);
            $radio_data   = json_decode($radio_result, true);
            if (empty($radio_data['abslist'])) {
                return;
            }
            foreach ($radio_data['abslist'] as $val) {
                $radio_songid[] = str_replace('MUSIC_', '', $val['MUSICRID']);
            }
            break;
        case 'qq':
            $radio_data = json_decode($radio_result, true);
            if (empty($radio_data['data']) || empty($radio_data['data']['song']) || empty($radio_data['data']['song']['list'])) {
                return;
            }
            foreach ($radio_data['data']['song']['list'] as $val) {
                $radio_songid[] = $val['songmid'];
            }
            break;
        case 'xiami':
            $radio_data = json_decode($radio_result, true);
            if (empty($radio_data['data']) || empty($radio_data['data']['songs'])) {
                return;
            }
            foreach ($radio_data['data']['songs'] as $val) {
                $radio_songid[] = $val['song_id'];
            }
            break;
        case '5singyc':
        case '5singfc':
            $radio_data = json_decode($radio_result, true);
            if (empty($radio_data['data']['songArray'])) {
                return;
            }
            foreach ($radio_data['data']['songArray'] as $val) {
                $radio_songid[] = $val['songId'];
            }
            break;
        case 'migu':
            $radio_data = json_decode($radio_result, true);
            if (empty($radio_data['musics'])) {
                return;
            }
            foreach ($radio_data['musics'] as $val) {
                $radio_songid[] = $val['id'];
            }
            break;
        case 'lizhi':
            $radio_data = json_decode($radio_result, true);
            if (empty($radio_data['audio']) || empty($radio_data['audio']['data'])) {
                return;
            }
            foreach ($radio_data['audio']['data'] as $val) {
                $radio_songid[] = $val['audio']['id'];
            }
            break;
        case 'qingting':
            $radio_data = json_decode($radio_result, true);
            if (empty($radio_data['data']) || empty($radio_data['data']['data'])) {
                return;
            }
            foreach ($radio_data['data']['data'][0]['doclist']['docs'] as $val) {
                $radio_songid[] = $val['parent_id'].'|'.$val['id'];
            }
            break;
        case 'ximalaya':
            $radio_data = json_decode($radio_result, true);
            if (empty($radio_data['track']) || empty($radio_data['track']['docs'])) {
                return;
            }
            foreach ($radio_data['track']['docs'] as $val) {
                if (!$val['is_paid']) { // 过滤付费的
                    $radio_songid[] = $val['id'];
                }
            }
            break;
        case 'kg':
            $radio_data = json_decode($radio_result, true);
            if (empty($radio_data['data']['ugclist'])) {
                return;
            }
            foreach ($radio_data['data']['ugclist'] as $val) {
                $radio_songid[] = $val['shareid'];
            }
            break;
        case 'netease':
        default:
            $radio_data = json_decode($radio_result, true);
            if (empty($radio_data['result']) || empty($radio_data['result']['songs'])) {
                return;
            }
            foreach ($radio_data['result']['songs'] as $val) {
                $radio_songid[] = $val['id'];
            }
            break;
    }
    $radio_page = mc_slice_name_search_songids($radio_songid, $page);
    mc_set_response_meta('has_more', $radio_page['has_more']);
    if (empty($radio_page['songids'])) {
        return;
    }
    return mc_get_song_by_id($radio_page['songids'], $site, true);
}

// 获取音频信息 - 歌曲ID
function mc_get_song_by_id($songid, $site = 'netease', $multi = false)
{
    if (empty($songid) || empty($site)) {
        return;
    }
    $radio_song_urls = [];
    $site_allow_multiple = [
        'netease',
        '1ting',
        'baidu',
        'qq',
        'xiami',
        'lizhi'
    ];
    if ($multi) {
        if (!is_array($songid)) {
            return;
        }
        if (in_array($site, $site_allow_multiple, true)) {
            $radio_song_urls[] = mc_song_urls(implode(',', $songid), 'songid', $site);
        } else {
            foreach ($songid as $key => $val) {
                $radio_song_urls[] = mc_song_urls($val, 'songid', $site);
            }
        }
    } else {
        $radio_song_urls[] = mc_song_urls($songid, 'songid', $site);
    }
    if (empty($radio_song_urls) || !array_key_exists(0, $radio_song_urls)) {
        return;
    }
    $radio_result = [];
    foreach ($radio_song_urls as $key => $val) {
        $radio_result[] = mc_curl($val);
    }
    if (empty($radio_result) || !array_key_exists(0, $radio_result)) {
        return;
    }
    $radio_songs = [];
    switch ($site) {
        case '1ting':
            foreach ($radio_result as $val) {
                $radio_data             = json_decode($val, true);
                if (!empty($radio_data)) {
                    foreach ($radio_data as $value) {
                        $radio_song_id  = $value['song_id'];
                        $radio_lrc_urls = mc_song_urls($radio_song_id, 'lrc', $site);
                        if ($radio_lrc_urls) {
                            $radio_lrc  = mc_curl($radio_lrc_urls);
                        }
                        $radio_songs[]  = [
                            'type'   => '1ting',
                            'link'   => 'http://www.1ting.com/player/6c/player_' . $radio_song_id . '.html',
                            'songid' => $radio_song_id,
                            'title'  => $value['song_name'],
                            'author' => $value['singer_name'],
                            'lrc'    => $radio_lrc,
                            'url'    => 'http://h5.1ting.com/file?url=' . str_replace('.wma', '.mp3', $value['song_filepath']),
                            'pic'    => 'http://img.store.sogou.com/net/a/link?&appid=100520102&w=500&h=500&url=' . $value['album_cover']
                        ];
                    }
                }
            }
            break;
        case 'baidu':
            foreach ($radio_result as $val) {
                $radio_json             = json_decode($val, true);
                $radio_data             = $radio_json['data']['songList'];
                if (!empty($radio_data)) {
                    foreach ($radio_data as $value) {
                        $radio_song_id  = $value['songId'];
                        $radio_lrc_urls = mc_song_urls($radio_song_id, 'lrc', $site);
                        if ($radio_lrc_urls) {
                            $radio_lrc  = json_decode(mc_curl($radio_lrc_urls), true);
                        }
                        $radio_songs[]  = [
                            'type'   => 'baidu',
                            'link'   => 'http://music.baidu.com/song/' . $radio_song_id,
                            'songid' => $radio_song_id,
                            'title'  => $value['songName'],
                            'author' => $value['artistName'],
                            'lrc'    => $radio_lrc['lrcContent'],
                            'url'    => str_replace(
                                [
                                    'yinyueshiting.baidu.com',
                                    'zhangmenshiting.baidu.com',
                                    'zhangmenshiting.qianqian.com'
                                ],
                                'gss0.bdstatic.com/y0s1hSulBw92lNKgpU_Z2jR7b2w6buu',
                                $value['songLink']
                            ),
                            'pic'    => $value['songPicBig']
                        ];
                    }
                }
            }
            break;
        case 'kugou':
            foreach ($radio_result as $val) {
                $radio_data           = json_decode($val, true);
                if (!empty($radio_data)) {
                    if (!$radio_data['url']) {
                        if (count($radio_result) === 1) {
                            $radio_songs      = [
                                'error' => $radio_data['privilege'] ? '源站反馈此音频需要付费' : '找不到可用的播放地址',
                                'code' => 403
                            ];
                            break;
                        }
                        // 过滤无效的
                        continue;
                    }
                    $radio_song_id    = $radio_data['hash'];
                    $radio_song_album = str_replace('{size}', '150', $radio_data['album_img']);
                    $radio_song_img   = str_replace('{size}', '150', $radio_data['imgUrl']);
                    $radio_lrc_urls   = mc_song_urls($radio_song_id, 'lrc', $site);
                    if ($radio_lrc_urls) {
                        $radio_lrc    = mc_curl($radio_lrc_urls);
                    }
                    $radio_songs[]    = [
                        'type'   => 'kugou',
                        'link'   => 'http://www.kugou.com/song/#hash=' . $radio_song_id,
                        'songid' => $radio_song_id,
                        'title'  => $radio_data['songName'],
                        'author' => $radio_data['singerName'],
                        'lrc'    => $radio_lrc,
                        'url'    => $radio_data['url'],
                        'pic'    => $radio_song_album ?: $radio_song_img
                    ];
                }
            }
            break;
        case 'kuwo':
            foreach ($radio_result as $val) {
                preg_match_all('/<([\w]+)>(.*?)<\/\\1>/i', $val, $radio_json);
                if (!empty($radio_json[1]) && !empty($radio_json[2])) {
                    $radio_data             = [];
                    foreach ($radio_json[1] as $key => $value) {
                        $radio_data[$value] = $radio_json[2][$key];
                    }
                    $radio_song_id          = $radio_data['music_id'];
                    $radio_lrc_urls         = mc_song_urls($radio_song_id, 'lrc', $site);
                    if ($radio_lrc_urls) {
                        $radio_lrc_info     = json_decode(mc_curl($radio_lrc_urls), true);
                    }
                    $radio_lrclist          = $radio_lrc_info['data']['lrclist'];
                    $radio_songs[]          = [
                        'type'   => 'kuwo',
                        'link'   => 'http://www.kuwo.cn/yinyue/' . $radio_song_id,
                        'songid' => $radio_song_id,
                        'title'  => $radio_data['name'],
                        'author' => $radio_data['singer'],
                        'lrc'    => generate_kuwo_lrc($radio_lrclist),
                        'url'    => 'http://' . $radio_data['mp3dl'] . '/resource/' . $radio_data['mp3path'],
                        'pic'    => $radio_data['artist_pic']
                    ];
                }
            }
            break;
        case 'qq':
            foreach ($radio_result as $val) {
                $radio_json                  = json_decode($val, true);
                $radio_data                  = $radio_json['data'];
                if (empty($radio_data)) {
                    continue;
                }
                foreach ($radio_data as $value) {
                    $radio_song_id       = $value['mid'];
                    $radio_authors       = [];
                    foreach ($value['singer'] as $singer) {
                        $radio_authors[] = $singer['title'];
                    }
                    $radio_author        = implode(',', $radio_authors);
                    $radio_lrc_urls      = mc_song_urls($radio_song_id, 'lrc', $site);
                    $radio_lrc           = [];
                    if ($radio_lrc_urls) {
                        $radio_lrc       = jsonp2json(mc_curl($radio_lrc_urls));
                    }
                    $radio_album_id      = $value['album']['mid'];
                    $radio_pic           = 'http://y.gtimg.cn/music/photo_new/T002R300x300M000' . $radio_album_id . '.jpg';
                    $radio_songs[]       = mc_qq_wrap_track([
                        'type'   => 'qq',
                        'link'   => 'https://y.qq.com/n/ryqq/songDetail/' . $radio_song_id,
                        'songid' => $radio_song_id,
                        'title'  => $value['title'],
                        'author' => $radio_author,
                        'lrc'    => str_decode($radio_lrc['lyric'] ?? ''),
                        'tlyric' => str_decode($radio_lrc['trans'] ?? ''),
                        'url'    => '',
                        'pic'    => $radio_pic,
                    ]);
                }
            }
            break;
        case 'xiami':
            foreach ($radio_result as $val) {
                $radio_json                 = json_decode($val, true);
                $radio_data                 = $radio_json['data']['trackList'];
                if (!empty($radio_data)) {
                    foreach ($radio_data as $value) {
                        $radio_lrc          = '';
                        $radio_song_id      = $value['songId'];
                        if ($value['lyric']) {
                            $radio_lrc_urls = mc_song_urls($value['lyric'], 'lrc', $site);
                            if ($radio_lrc_urls) {
                                $radio_lrc  = mc_curl($radio_lrc_urls);
                            }
                        }
                        $radio_songs[]      = [
                            'type'   => 'xiami',
                            'link'   => 'http://www.xiami.com/song/' . $radio_song_id,
                            'songid' => $radio_song_id,
                            'title'  => $value['songName'],
                            'author' => $value['singers'],
                            'lrc'    => $radio_lrc,
                            'url'    => decode_xiami_location($value['location']),
                            'pic'    => $value['album_pic']
                        ];
                    }
                } else {
                    if ($radio_json['message']) {
                        $radio_songs        = [
                            'error' => $radio_json['message'],
                            'code' => 403
                        ];
                        break;
                    }
                }
            }
            break;
        case '5singyc':
        case '5singfc':
            foreach ($radio_result as $val) {
                $radio_json        = json_decode($val, true);
                $radio_data        = $radio_json['data'];
                if (!empty($radio_data)) {
                    $radio_song_id = $radio_data['ID'];
                    $radio_songs[] = [
                        'type'   => $site,
                        'link'   => 'http://5sing.kugou.com/'.$radio_data['SK'] . '/' . $radio_song_id . '.html',
                        'songid' => $radio_song_id,
                        'title'  => $radio_data['SN'],
                        'author' => $radio_data['user']['NN'],
                        'lrc'    => $radio_data['dynamicWords'],
                        'url'    => $radio_data['KL'],
                        'pic'    => $radio_data['user']['I']
                    ];
                }
            }
            break;
        case 'migu':
            foreach ($radio_result as $val) {
                if (MC_INTERNAL) {
                    $radio_data = json_decode($val, true);
                    if (!empty($radio_data)) {
                        $radio_song_id       = $radio_data['musicId'];
                        $radio_authors       = [];
                        foreach ($radio_data['artistInfoList'] as $author) {
                            $radio_authors[] = $author['artistName'];
                        }
                        $radio_author        = implode(',', $radio_authors);
                        $radio_songs[] = [
                            'type'   => 'migu',
                            'link'   => 'http://music.migu.cn/v2/music/song/' . $radio_song_id,
                            'songid' => $radio_song_id,
                            'title'  => $radio_data['musicName'],
                            'author' => $radio_author,
                            'lrc'    => $radio_data['dynamicLyric'],
                            'url'    => $radio_data['songAuditionUrl'],
                            'pic'    => $radio_data['smallPic']
                        ];
                    }
                } else {
                    $radio_json = json_decode($val, true);
                    $radio_data = $radio_json['data'];
                    if (!empty($radio_data)) {
                        $radio_song_id = $radio_data['songId'];
                        $radio_author  = implode(',', $radio_data['singerName']);
                        $radio_songs[] = [
                            'type'   => 'migu',
                            'link'   => 'http://music.migu.cn/v2/music/song/' . $radio_song_id,
                            'songid' => $radio_song_id,
                            'title'  => $radio_data['songName'],
                            'author' => $radio_author,
                            'lrc'    => $radio_data['lyricLrc'],
                            'url'    => $radio_data['listenUrl'] ?: $radio_data['sst']['listenUrl'],
                            'pic'    => $radio_data['picL']
                        ];
                    }
                }
            }
            break;
        case 'lizhi':
            foreach ($radio_result as $val) {
                $radio_data            = json_decode($val, true);
                if (!empty($radio_data)) {
                    foreach ($radio_data as $value) {
                        $radio_song_id = $value['audio']['id'];
                        $radio_streams = [
                            'method'  => 'GET',
                            'url'     => 'http://www.lizhi.fm/media/url/' . $radio_song_id,
                            'referer' => 'http://www.lizhi.fm',
                            'proxy'   => false,
                            'body'    => false
                        ];
                        $radio_info = json_decode(mc_curl($radio_streams), true);
                        $radio_songs[] = [
                            'type'   => 'lizhi',
                            'link'   => 'http://www.lizhi.fm/' . $value['radio']['band'] . '/' . $radio_song_id,
                            'songid' => $radio_song_id,
                            'title'  => $value['audio']['name'],
                            'author' => $value['radio']['name'],
                            'lrc'    => '',
                            'url'    => $radio_info ? $radio_info['data']['url'] : null,
                            'pic'    => 'http://m.lizhi.fm/radio_cover/' . $value['radio']['cover']
                        ];
                    }
                }
            }
            break;
        case 'qingting':
            foreach ($radio_result as $val) {
                $radio_json           = json_decode($val, true);
                $radio_data           = $radio_json['data'];
                if (!empty($radio_data)) {
                    $radio_channels   = [
                        'method'  => 'GET',
                        'url'     => 'http://i.qingting.fm/wapi/channels/' . $radio_data['channel_id'],
                        'referer' => 'http://www.qingting.fm',
                        'proxy'   => false,
                        'body'    => false
                    ];
                    $radio_info       = json_decode(mc_curl($radio_channels), true);
                    if (!empty($radio_info) && !empty($radio_info['data'])) {
                        $radio_author = $radio_info['data']['name'];
                        $radio_pic    = $radio_info['data']['img_url'];
                    }
                    $radio_songs[]    = [
                        'type'   => 'qingting',
                        'link'   => 'http://www.qingting.fm/channels/' . $radio_data['channel_id'] . '/programs/' . $radio_data['id'],
                        'songid' => $radio_data['channel_id'] . '|' . $radio_data['id'],
                        'title'  => $radio_data['name'],
                        'author' => $radio_author,
                        'lrc'    => '',
                        'url'    => 'http://od.qingting.fm/' . $radio_data['file_path'],
                        'pic'    => $radio_pic
                    ];
                }
            }
            break;
        case 'ximalaya':
            foreach ($radio_result as $val) {
                $radio_json        = json_decode($val, true);
                $radio_data        = $radio_json['trackInfo'];
                $radio_user        = $radio_json['userInfo'];
                if (!empty($radio_data) && !empty($radio_user)) {
                    if ($radio_data['isPaid']) {
                        $radio_songs = [
                            'error' => '源站反馈此音频需要付费',
                            'code' => 403
                        ];
                        break;
                    }
                    $radio_songs[] = [
                        'type'   => 'ximalaya',
                        'link'   => 'http://www.ximalaya.com/' . $radio_data['uid'] . '/sound/' . $radio_data['trackId'],
                        'songid' => $radio_data['trackId'],
                        'title'  => $radio_data['title'],
                        'author' => $radio_user['nickname'],
                        'lrc'    => '',
                        'url'    => $radio_data['playUrl64'],
                        'pic'    => $radio_data['coverLarge']
                    ];
                }
            }
            break;
        case 'kg':
            foreach ($radio_result as $key => $val) {
                $radio_json        = json_decode($val, true);
                $radio_data        = $radio_json['data'];
                if (!empty($radio_data)) {
                    $radio_song_id      = is_array($songid) ? $songid[$key] : $songid;
                    $radio_lrc_urls     = mc_song_urls($radio_data['ksong_mid'], 'lrc', $site);
                    if ($radio_lrc_urls) {
                        $radio_lrc_info = json_decode(mc_curl($radio_lrc_urls), true);
                    }
                    $radio_songs[] = [
                        'type'   => 'kg',
                        'link'   => 'https://kg.qq.com/node/play?s=' . $radio_song_id . '&shareuid='. $radio_data['uid'],
                        'songid' => $radio_song_id,
                        'title'  => $radio_data['song_name'],
                        'author' => $radio_data['nick'],
                        'lrc'    => $radio_lrc_info['data']['lyric'],
                        'url'    => $radio_data['playurl'],
                        'pic'    => $radio_data['cover']
                    ];
                }
            }
        break;
        case 'netease':
        default:
            foreach ($radio_result as $val) {
                $radio_json                  = json_decode($val, true);
                $radio_data                  = $radio_json['songs'];
                if (!empty($radio_data)) {
                    foreach ($radio_data as $value) {
                        $radio_song_id       = $value['id'];
                        $radio_authors       = [];
                        foreach ($value['artists'] as $key => $val) {
                            $radio_authors[] = $val['name'];
                        }
                        $radio_author        = implode(',', $radio_authors);
                        $radio_lrc_urls      = mc_song_urls($radio_song_id, 'lrc', $site);
                        $radio_lrc           = [];
                        if ($radio_lrc_urls) {
                            $radio_lrc       = json_decode(mc_curl($radio_lrc_urls), true);
                        }
                        $radio_pic           = $value['album']['picUrl'] . '?param=300x300';
                        $radio_songs[]       = mc_netease_wrap_track([
                            'type'   => 'netease',
                            'link'   => 'http://music.163.com/#/song?id=' . $radio_song_id,
                            'songid' => $radio_song_id,
                            'title'  => $value['name'],
                            'author' => $radio_author,
                            'lrc'    => mc_netease_lyric_text($radio_lrc, 'lrc'),
                            'yrc'    => mc_netease_lyric_text($radio_lrc, 'yrc'),
                            'tlyric' => mc_netease_lyric_text($radio_lrc, 'tlyric'),
                            'url'    => '',
                            'pic'    => $radio_pic
                        ]);
                    }
                }
            }
            break;
    }
    return !empty($radio_songs) ? $radio_songs : '';
}

// 获取音频信息 - url
function mc_get_song_by_url($url)
{
    preg_match('/music\.163\.com\/(#(\/m)?|m)\/song(\?id=|\/)(\d+)/i', $url, $match_netease);
    preg_match('/(www|m)\.1ting\.com\/(player\/b6\/player_|#\/song\/)(\d+)/i', $url, $match_1ting);
    preg_match('/music\.baidu\.com\/song\/(\d+)/i', $url, $match_baidu);
    preg_match('/(m|www)\.kugou\.com\/(play\/info\/|song\/\#hash\=)([a-z0-9]+)/i', $url, $match_kugou);
    preg_match('/www\.kuwo\.cn\/(yinyue|my)\/(\d+)/i', $url, $match_kuwo);
    preg_match('/(y\.qq\.com\/n\/yqq\/song\/|data\.music\.qq\.com\/playsong\.html\?songmid=)([a-zA-Z0-9]+)/i', $url, $match_qq);
    preg_match('/(www|m)\.xiami\.com\/song\/([a-zA-Z0-9]+)/i', $url, $match_xiami);
    preg_match('/5sing\.kugou\.com\/(m\/detail\/|)yc(-|\/)(\d+)/i', $url, $match_5singyc);
    preg_match('/5sing\.kugou\.com\/(m\/detail\/|)fc(-|\/)(\d+)/i', $url, $match_5singfc);
    preg_match('/music\.migu\.cn(\/(#|v2\/music))?\/song\/(\d+)/i', $url, $match_migu);
    preg_match('/(www|m)\.lizhi\.fm\/(\d+)\/(\d+)/i', $url, $match_lizhi);
    preg_match('/(www|m)\.qingting\.fm\/channels\/(\d+)\/programs\/(\d+)/i', $url, $match_qingting);
    preg_match('/(www|m)\.ximalaya\.com\/(\d+)\/sound\/(\d+)/i', $url, $match_ximalaya);
    preg_match('/kg\d?\.qq\.com\/(node\/)?play\?s=([a-zA-Z0-9_-]+)/i', $url, $match_kg_id);
    preg_match('/kg\d?\.qq\.com\/(node\/)?personal\?uid=([a-z0-9_-]+)/i', $url, $match_kg_uid);
    if (!empty($match_netease)) {
        $songid   = $match_netease[4];
        $songtype = 'netease';
    } elseif (!empty($match_1ting)) {
        $songid   = $match_1ting[3];
        $songtype = '1ting';
    } elseif (!empty($match_baidu)) {
        $songid   = $match_baidu[1];
        $songtype = 'baidu';
    } elseif (!empty($match_kugou)) {
        $songid   = $match_kugou[3];
        $songtype = 'kugou';
    } elseif (!empty($match_kuwo)) {
        $songid   = $match_kuwo[2];
        $songtype = 'kuwo';
    } elseif (!empty($match_qq)) {
        $songid   = $match_qq[2];
        $songtype = 'qq';
    } elseif (!empty($match_xiami)) {
        $songid   = $match_xiami[2];
        $songtype = 'xiami';
    } elseif (!empty($match_5singyc)) {
        $songid   = $match_5singyc[3];
        $songtype = '5singyc';
    } elseif (!empty($match_5singfc)) {
        $songid   = $match_5singfc[3];
        $songtype = '5singfc';
    } elseif (!empty($match_migu)) {
        $songid   = $match_migu[3];
        $songtype = 'migu';
    } elseif (!empty($match_lizhi)) {
        $songid   = $match_lizhi[3];
        $songtype = 'lizhi';
    } elseif (!empty($match_qingting)) {
        $songid   = $match_qingting[2].'|'.$match_qingting[3];
        $songtype = 'qingting';
    } elseif (!empty($match_ximalaya)) {
        $songid   = $match_ximalaya[3];
        $songtype = 'ximalaya';
    }  elseif (!empty($match_kg_id)) {
        $songid   = $match_kg_id[2];
        $songtype = 'kg';
    }  elseif (!empty($match_kg_uid)) {
        return mc_get_song_by_name($match_kg_uid[2], 'kg');
    } else {
        return;
    }
    return mc_get_song_by_id($songid, $songtype);
}

// 解密虾米 location
function decode_xiami_location($location)
{
    $location     = trim($location);
    $result       = [];
    $line         = intval($location[0]);
    $locLen       = strlen($location);
    $rows         = intval(($locLen - 1) / $line);
    $extra        = ($locLen - 1) % $line;
    $location     = substr($location, 1);
    for ($i       = 0; $i < $extra; ++$i) {
        $start    = ($rows + 1) * $i;
        $end      = ($rows + 1) * ($i + 1);
        $result[] = substr($location, $start, $end - $start);
    }
    for ($i       = 0; $i < $line - $extra; ++$i) {
        $start    = ($rows + 1) * $extra + ($rows * $i);
        $end      = ($rows + 1) * $extra + ($rows * $i) + $rows;
        $result[] = substr($location, $start, $end - $start);
    }
    $url          = '';
    for ($i       = 0; $i < $rows + 1; ++$i) {
        for ($j   = 0; $j < $line; ++$j) {
            if ($j >= count($result) || $i >= strlen($result[$j])) {
                continue;
            }
            $url .= $result[$j][$i];
        }
    }
    $url          = urldecode($url);
    $url          = str_replace('^', '0', $url);
    return $url;
}

function mc_netease_lyric_text($payload, $field)
{
    if (!is_array($payload)) {
        return '';
    }
    if ($field === 'yrc') {
        if (!empty($payload['yrc']['lyric'])) {
            return $payload['yrc']['lyric'];
        }
        if (!empty($payload['lrc']['yrc']['lyric'])) {
            return $payload['lrc']['yrc']['lyric'];
        }
        return '';
    }
    if ($field === 'tlyric') {
        if (!empty($payload['yrc']['lyric']) && !empty($payload['ytlrc']['lyric'])) {
            return $payload['ytlrc']['lyric'];
        }
        if (!empty($payload['lrc']['ytlrc']['lyric'])) {
            return $payload['lrc']['ytlrc']['lyric'];
        }
        if (!empty($payload['tlyric']['lyric'])) {
            return $payload['tlyric']['lyric'];
        }
        return '';
    }
    return !empty($payload['lrc']['lyric']) ? $payload['lrc']['lyric'] : '';
}

// 加密网易云音乐 api 参数
function encode_netease_data($data)
{
    $_key     = '7246674226682325323F5E6544673A51';
    $data     = json_encode($data);
    if (function_exists('openssl_encrypt')) {
        $data = openssl_encrypt($data, 'aes-128-ecb', pack('H*', $_key));
    } else {
        $_pad = 16 - (strlen($data) % 16);
        $data = base64_encode(mcrypt_encrypt(
            MCRYPT_RIJNDAEL_128,
            hex2bin($_key),
            $data.str_repeat(chr($_pad), $_pad),
            MCRYPT_MODE_ECB
        ));
    }
    $data     = strtoupper(bin2hex(base64_decode($data)));
    return ['eparams' => $data];
}

// 分割 songid 并获取
function split_songid($songid, $index = 0, $delimiter = '|') {
    if (mb_strpos($songid, $delimiter, 0, 'UTF-8') > 0) {
        $array = explode($delimiter, $songid);
        if (count($array) > 1) {
            return $array[$index];
        }
    }
    return;
}

// 生成 QQ 音乐各品质链接
function generate_qqmusic_url($songmid, $key) {
    $quality = array('M800', 'M500', 'C400');
    foreach ($quality as $value) {
        $url = 'http://dl.stream.qqmusic.qq.com/' . $value . $songmid . '.mp3?vkey=' . $key . '&guid=5150825362&fromtag=1';
        if (!mc_is_error($url)) {
            return $url;
        }
    }
}

// 生成酷我音乐歌词
function generate_kuwo_lrc($lrclist) {
    if (!empty($lrclist)) {
        $lrc = '';
        foreach ($lrclist as $val) {
            if ($val['time'] > 60) {
                $time_exp = explode('.', round($val['time'] / 60, 4));
                $minute = $time_exp[0] < 10 ? '0' . $time_exp[0] : $time_exp[0];
                $sec = substr($time_exp[1], 0, 2) . '.' . substr($time_exp[1], 2, 2);
                $time = '[' . $minute . ':' . $sec . ']';
            } else {
                $time = '[00:' . $val['time'] . ']';
            }
            $lrc .= $time . $val['lineLyric'] . "\n";
        }
        return $lrc;
    }
}

// jsonp 转 json
function jsonp2json($jsonp) {
    if ($jsonp[0] !== '[' && $jsonp[0] !== '{') {
        $jsonp = mb_substr($jsonp, mb_strpos($jsonp, '('));
    }
    $json = trim($jsonp, "();");
    if ($json) {
        return json_decode($json, true);
    }
}

// 去除字符串转义
function str_decode($str) {
    $str = str_replace(['&#13;', '&#10;'], ['', "\n"], $str);
    $str = html_entity_decode($str, ENT_QUOTES, 'UTF-8');
    return $str;
}

// --- QQ 资源代理（签名 api.php + fcg_pyq_play 取链） ---

function mc_api_secret()
{
    if (defined('MC_API_SECRET') && MC_API_SECRET !== '') {
        return MC_API_SECRET;
    }
    // 不绑定 MC_VERSION：入口文件版本偶发不一致时会导致全站播放/封面 403
    return hash('sha256', MC_CORE_DIR . '|ryanmusic-api');
}

function mc_api_sign($get, $type, $id, $t)
{
    $payload = $get . '|' . $type . '|' . $id . '|' . $t;
    $raw = hash_hmac('sha256', $payload, mc_api_secret(), true);
    return substr(strtr(base64_encode($raw), '+/=', '._-'), 0, 13);
}

function mc_api_verify_sign($get, $type, $id, $t, $sign)
{
    if (!$sign || !$t) {
        return false;
    }
    if (abs(time() - (int) $t) > 86400) {
        return false;
    }
    return hash_equals(mc_api_sign($get, $type, $id, $t), $sign);
}

function mc_api_proxy_url($get, $type, $id)
{
    $t = time();
    return 'api.php?' . http_build_query([
        'get'   => $get,
        'type'  => $type,
        'id'    => $id,
        'sign'  => mc_api_sign($get, $type, $id, $t),
        't'     => $t,
    ]);
}

function mc_qq_cache_dir($subdir)
{
    // Windows 安装到 Program Files 时 core/cache 可能只读；宿主可通过环境变量指定可写目录
    $base = getenv('RYANMUSIC_CACHE_DIR');
    if (!is_string($base) || $base === '') {
        $base = MC_CORE_DIR . '/cache';
    }
    $dir = rtrim(str_replace('\\', '/', $base), '/') . '/' . $subdir;
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return $dir;
}

function mc_qq_cache_file($subdir, $key)
{
    return mc_qq_cache_dir($subdir) . '/' . preg_replace('/[^a-zA-Z0-9]/', '_', $key) . '.json';
}

function mc_qq_pyq_cache_get($songmid)
{
    $path = mc_qq_cache_file('qq_pyq', $songmid);
    if (!is_file($path)) {
        return null;
    }
    $data = json_decode(file_get_contents($path), true);
    if (empty($data['code'])) {
        return null;
    }
    if (!empty($data['expires']) && $data['expires'] < time()) {
        return null;
    }
    return $data['code'];
}

function mc_qq_pyq_cache_set($songmid, $code)
{
    file_put_contents(mc_qq_cache_file('qq_pyq', $songmid), json_encode([
        'code'    => $code,
        'expires' => time() + 7 * 86400,
    ]));
}

function mc_qq_play_cache_get($songmid)
{
    $path = mc_qq_cache_file('qq_play', $songmid);
    if (!is_file($path)) {
        return null;
    }
    $data = json_decode(file_get_contents($path), true);
    if (empty($data['url']) || empty($data['expires']) || $data['expires'] < time()) {
        return null;
    }
    return $data['url'];
}

function mc_qq_play_cache_set($songmid, $url, $ttl = 1800)
{
    file_put_contents(mc_qq_cache_file('qq_play', $songmid), json_encode([
        'url'     => $url,
        'expires' => time() + $ttl,
    ]));
}

function mc_qq_bootstrap_base()
{
    if (!defined('MC_QQ_PYQ_BOOTSTRAP') || !MC_QQ_PYQ_BOOTSTRAP) {
        return null;
    }
    return rtrim(MC_QQ_PYQ_BOOTSTRAP, '/');
}

function mc_qq_bootstrap_pyq_code($songmid)
{
    $base = mc_qq_bootstrap_base();
    if (!$base) {
        return null;
    }
    $resp = mc_curl([
        'method'  => 'POST',
        'url'     => $base . '/',
        'referer' => $base . '/',
        'headers' => [
            'X-Requested-With: XMLHttpRequest',
            'Content-Type: application/x-www-form-urlencoded',
        ],
        'body'    => http_build_query([
            'input'  => $songmid,
            'filter' => 'id',
            'type'   => 'qq',
            'page'   => 1,
        ]),
    ]);
    $json = json_decode($resp, true);
    if (empty($json['data'][0]['url'])) {
        return null;
    }
    $api = $base . '/' . ltrim($json['data'][0]['url'], '/');
    $ch = curl_init($api);
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER         => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER     => [
            'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Referer: ' . $base . '/',
        ],
    ];
    if (defined('MC_PROXY') && MC_PROXY) {
        $opts[CURLOPT_HTTPPROXYTUNNEL] = 1;
        $opts[CURLOPT_PROXY] = MC_PROXY;
        $opts[CURLOPT_PROXYUSERPWD] = MC_PROXYUSERPWD;
    } else {
        $opts = mc_curl_direct_opts() + $opts;
    }
    $resolve = mc_curl_resolve_list($api);
    if ($resolve) {
        $opts[CURLOPT_RESOLVE] = $resolve;
    }
    curl_setopt_array($ch, $opts);
    $raw = curl_exec($ch);
    curl_close($ch);
    if (preg_match('/[?&]code=([^&\s\'"]+)/', $raw, $m)) {
        return $m[1];
    }
    return null;
}

function mc_qq_get_pyq_code($songmid)
{
    $cached = mc_qq_pyq_cache_get($songmid);
    if ($cached) {
        return $cached;
    }
    $code = mc_qq_bootstrap_pyq_code($songmid);
    if ($code) {
        mc_qq_pyq_cache_set($songmid, $code);
    }
    return $code;
}

function mc_qq_curl_redirect($url, $referer = 'https://y.qq.com/')
{
    $ch = curl_init($url);
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER         => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER     => [
            'Referer: ' . $referer,
            'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ],
    ];
    if (defined('MC_PROXY') && MC_PROXY) {
        $opts[CURLOPT_HTTPPROXYTUNNEL] = 1;
        $opts[CURLOPT_PROXY] = MC_PROXY;
        $opts[CURLOPT_PROXYUSERPWD] = MC_PROXYUSERPWD;
    } else {
        $opts = mc_curl_direct_opts() + $opts;
    }
    $resolve = mc_curl_resolve_list($url);
    if ($resolve) {
        $opts[CURLOPT_RESOLVE] = $resolve;
    }
    curl_setopt_array($ch, $opts);
    $resp = curl_exec($ch);
    $loc = curl_getinfo($ch, CURLINFO_REDIRECT_URL);
    curl_close($ch);
    if (!$loc && is_string($resp) && preg_match('/^Location:\s*(.+)$/mi', $resp, $m)) {
        $loc = trim($m[1]);
    }
    return $loc ?: null;
}

function mc_qq_pyq_follow($songmid, $code)
{
    $play = 'https://c6.y.qq.com/rsc/fcgi-bin/fcg_pyq_play.fcg?' . http_build_query([
        'songid'   => '',
        'songmid'  => $songmid,
        'songtype' => 1,
        'fromtag'  => 'myhkw.cn',
        'uin'      => '10001',
        'code'     => $code,
        'cache'    => date('mdHis'),
    ]);
    $loc = mc_qq_curl_redirect($play);
    if (!$loc) {
        return null;
    }
    if (stripos($loc, 'stream.qqmusic.qq.com') !== false || stripos($loc, 'aqqmusic.tc.qq.com') !== false) {
        return $loc;
    }
    return mc_qq_curl_redirect($loc) ?: $loc;
}

function mc_qq_bootstrap_play_url($songmid)
{
    $base = mc_qq_bootstrap_base();
    if (!$base) {
        return null;
    }
    $resp = mc_curl([
        'method'  => 'POST',
        'url'     => $base . '/',
        'referer' => $base . '/',
        'headers' => [
            'X-Requested-With: XMLHttpRequest',
            'Content-Type: application/x-www-form-urlencoded',
        ],
        'body'    => http_build_query([
            'input'  => $songmid,
            'filter' => 'id',
            'type'   => 'qq',
            'page'   => 1,
        ]),
    ]);
    $json = json_decode($resp, true);
    if (empty($json['data'][0]['url'])) {
        return null;
    }
    $api = $base . '/' . ltrim($json['data'][0]['url'], '/');
    $loc = mc_qq_curl_redirect($api, $base . '/');
    if (!$loc) {
        return null;
    }
    if (stripos($loc, 'stream.qqmusic.qq.com') !== false || stripos($loc, 'aqqmusic.tc.qq.com') !== false) {
        return $loc;
    }
    return mc_qq_curl_redirect($loc) ?: $loc;
}

function mc_qq_resolve_play_url($songmid)
{
    $cached = mc_qq_play_cache_get($songmid);
    if ($cached) {
        return $cached;
    }

    $code = mc_qq_get_pyq_code($songmid);
    if ($code) {
        $url = mc_qq_pyq_follow($songmid, $code);
        if ($url && !mc_is_error($url)) {
            mc_qq_play_cache_set($songmid, $url);
            return $url;
        }
    }

    $url = mc_qq_bootstrap_play_url($songmid);
    if ($url && !mc_is_error($url)) {
        mc_qq_play_cache_set($songmid, $url);
        return $url;
    }
    return null;
}

function mc_qq_song_detail($songmid)
{
    static $cache = [];
    if (isset($cache[$songmid])) {
        return $cache[$songmid];
    }
    $raw = mc_curl([
        'url'        => 'http://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg?songmid=' . urlencode($songmid) . '&format=json',
        'referer'    => 'https://y.qq.com/',
        'user-agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    ]);
    $json = json_decode($raw, true);
    $cache[$songmid] = $json['data'][0] ?? null;
    return $cache[$songmid];
}

function mc_qq_resolve_pic_url($songmid)
{
    $detail = mc_qq_song_detail($songmid);
    $album_mid = $detail['album']['mid'] ?? '';
    if (!$album_mid) {
        return null;
    }
    return 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' . $album_mid . '.jpg';
}

function mc_qq_resolve_lrc_text($songmid)
{
    $raw = mc_curl([
        'url'        => 'https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=' . urlencode($songmid) . '&format=json&nobase64=1',
        'referer'    => 'https://y.qq.com/',
        'user-agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    ]);
    $json = json_decode($raw, true);
    if (empty($json['lyric'])) {
        return "[00:00.00] 暂无歌词\n";
    }
    return str_decode($json['lyric']);
}

function mc_qq_wrap_track($song)
{
    if (($song['type'] ?? '') !== 'qq' || empty($song['songid'])) {
        return $song;
    }
    $id = $song['songid'];
    $song['url'] = mc_api_proxy_url('url', 'qq', $id);
    $song['pic'] = mc_api_proxy_url('pic', 'qq', $id);
    return $song;
}

function mc_netease_play_cache_get($songid)
{
    $path = mc_qq_cache_file('netease_play', $songid);
    if (!is_file($path)) {
        return null;
    }
    $data = json_decode(file_get_contents($path), true);
    if (empty($data['url']) || empty($data['expires']) || $data['expires'] < time()) {
        return null;
    }
    return $data['url'];
}

function mc_netease_play_cache_set($songid, $url, $ttl = 600)
{
    file_put_contents(mc_qq_cache_file('netease_play', $songid), json_encode([
        'url'     => $url,
        'expires' => time() + $ttl,
    ]));
}

function mc_netease_https_url($url)
{
    if (!$url) {
        return $url;
    }
    if (stripos($url, 'http://') === 0 && preg_match('#(126\.net|163\.com)#i', $url)) {
        return 'https://' . substr($url, 7);
    }
    return $url;
}

function mc_netease_official_play_url($songid)
{
    $streams = [
        'method'  => 'POST',
        'url'     => 'http://music.163.com/api/linux/forward',
        'referer' => 'http://music.163.com/',
        'proxy'   => false,
        'body'    => encode_netease_data([
            'method' => 'POST',
            'url'    => 'http://music.163.com/api/song/enhance/player/url',
            'params' => [
                'ids' => [(int) $songid],
                'br'  => 320000,
            ],
        ]),
    ];
    $info = json_decode(mc_curl($streams), true);
    $url = $info['data'][0]['url'] ?? null;
    if ($url && !mc_is_error($url)) {
        return $url;
    }
    return null;
}

function mc_netease_bootstrap_play_url($songid)
{
    $base = mc_qq_bootstrap_base();
    if (!$base) {
        return null;
    }
    $resp = mc_curl([
        'method'  => 'POST',
        'url'     => $base . '/',
        'referer' => $base . '/',
        'headers' => [
            'X-Requested-With: XMLHttpRequest',
            'Content-Type: application/x-www-form-urlencoded',
        ],
        'body'    => http_build_query([
            'input'  => $songid,
            'filter' => 'id',
            'type'   => 'netease',
            'page'   => 1,
        ]),
    ]);
    $json = json_decode($resp, true);
    if (empty($json['data'][0]['url'])) {
        return null;
    }
    $api = $base . '/' . ltrim($json['data'][0]['url'], '/');
    $loc = mc_qq_curl_redirect($api, $base . '/');
    if (!$loc) {
        return null;
    }
    if (preg_match('#(126\.net|163\.com|music\.163)#i', $loc)) {
        return $loc;
    }
    return mc_qq_curl_redirect($loc, $base . '/') ?: $loc;
}

// Meting 公共接口回退（官方/引导源失败时）
function mc_netease_meting_play_url($songid)
{
    $endpoints = [
        'https://api.injahow.cn/meting/?server=netease&type=url&id=' . rawurlencode($songid),
        'https://api.injahow.cn/meting/?type=url&id=' . rawurlencode($songid),
    ];
    foreach ($endpoints as $endpoint) {
        $loc = mc_qq_curl_redirect($endpoint, 'https://api.injahow.cn/');
        if ($loc && !mc_is_error($loc) && preg_match('#(126\.net|163\.com|music\.163)#i', $loc)) {
            return $loc;
        }
    }
    return null;
}

function mc_netease_resolve_play_url($songid)
{
    $cached = mc_netease_play_cache_get($songid);
    if ($cached) {
        return $cached;
    }

    $url = mc_netease_official_play_url($songid);
    if (!$url) {
        $url = mc_netease_bootstrap_play_url($songid);
    }
    if (!$url) {
        $url = mc_netease_meting_play_url($songid);
    }
    if ($url && !mc_is_error($url) && stripos($url, '/404') === false) {
        $url = mc_netease_https_url($url);
        mc_netease_play_cache_set($songid, $url);
        return $url;
    }
    return null;
}

function mc_netease_resolve_pic_url($songid)
{
    $raw = mc_curl([
        'method'  => 'POST',
        'url'     => 'http://music.163.com/api/linux/forward',
        'referer' => 'http://music.163.com/',
        'proxy'   => false,
        'body'    => encode_netease_data([
            'method' => 'GET',
            'url'    => 'http://music.163.com/api/song/detail',
            'params' => [
                'id'  => $songid,
                'ids' => '[' . $songid . ']',
            ],
        ]),
    ]);
    $json = json_decode($raw, true);
    $pic = $json['songs'][0]['album']['picUrl'] ?? null;
    if (!$pic) {
        return null;
    }
    return mc_netease_https_url($pic . (strpos($pic, '?') === false ? '?param=300x300' : ''));
}

function mc_netease_wrap_track($song)
{
    if (($song['type'] ?? '') !== 'netease' || empty($song['songid'])) {
        return $song;
    }
    $id = $song['songid'];
    $song['url'] = mc_api_proxy_url('url', 'netease', $id);
    $song['pic'] = mc_api_proxy_url('pic', 'netease', $id);
    return $song;
}

function mc_api_handle_request()
{
    $get = isset($_GET['get']) ? trim($_GET['get']) : '';
    $type = isset($_GET['type']) ? trim($_GET['type']) : '';
    $id = isset($_GET['id']) ? trim($_GET['id']) : '';
    $sign = isset($_GET['sign']) ? trim($_GET['sign']) : '';
    $t = isset($_GET['t']) ? trim($_GET['t']) : '';

    if (!$get || !$type || !$id || !$sign || !$t) {
        header('HTTP/1.1 400 Bad Request');
        exit('缺少请求参数');
    }
    if (!mc_api_verify_sign($get, $type, $id, $t, $sign)) {
        header('HTTP/1.1 403 Forbidden');
        exit('非法请求');
    }
    if (!in_array($type, ['qq', 'netease', 'wy'], true)) {
        header('HTTP/1.1 400 Bad Request');
        exit('暂不支持该音源');
    }
    if ($type === 'wy') {
        $type = 'netease';
    }
    if ($type === 'qq' && !preg_match('/^[a-zA-Z0-9]+$/', $id)) {
        header('HTTP/1.1 400 Bad Request');
        exit('Invalid id');
    }
    if ($type === 'netease' && !preg_match('/^\d+$/', $id)) {
        header('HTTP/1.1 400 Bad Request');
        exit('Invalid id');
    }

    switch ($get) {
        case 'url':
            $play_url = ($type === 'qq')
                ? mc_qq_resolve_play_url($id)
                : mc_netease_resolve_play_url($id);
            if (!$play_url) {
                header('HTTP/1.1 502 Bad Gateway');
                header('Content-Type: text/plain; charset=utf-8');
                exit('无法获取播放地址');
            }
            $name = isset($_GET['name']) ? $_GET['name'] : 'RyanMusic';
            $name = preg_replace('/[\\\\\/:*?"<>|\x00-\x1F]/u', '_', $name);
            if (!preg_match('/\.mp3$/i', $name)) {
                $name .= '.mp3';
            }
            // 优先同源流式代理（macOS WKWebView / 光影分析依赖）；失败再 302
            $ok = mc_proxy_stream($play_url, [
                'download'     => !empty($_GET['dl']),
                'filename'     => $name,
                'content_type' => 'audio/mpeg',
            ]);
            if ($ok) {
                exit;
            }
            if (empty($_GET['dl'])) {
                header('Location: ' . $play_url, true, 302);
                exit;
            }
            header('HTTP/1.1 502 Bad Gateway');
            header('Content-Type: text/plain; charset=utf-8');
            exit('无法获取播放地址');
        case 'pic':
            $pic = ($type === 'qq')
                ? mc_qq_resolve_pic_url($id)
                : mc_netease_resolve_pic_url($id);
            if (!$pic) {
                header('HTTP/1.1 404 Not Found');
                exit('封面不存在');
            }
            $ok = mc_proxy_stream($pic, [
                'download'     => false,
                'content_type' => 'image/jpeg',
            ]);
            if (!$ok) {
                header('Location: ' . $pic, true, 302);
            }
            exit;
        case 'lrc':
            if ($type !== 'qq') {
                header('HTTP/1.1 400 Bad Request');
                exit('该音源歌词无需代理');
            }
            header('Content-Type: text/plain; charset=utf-8');
            echo mc_qq_resolve_lrc_text($id);
            exit;
        default:
            header('HTTP/1.1 400 Bad Request');
            exit('未知资源类型');
    }
}

require_once __DIR__ . '/netease_account.php';
require_once __DIR__ . '/qq_account.php';

// Server
function server($key)
{
    return isset($_SERVER[$key]) ? $_SERVER[$key] : null;
}

// Post
function post($key)
{
    return isset($_POST[$key]) ? $_POST[$key] : null;
}

// Response
function response($data, $code = 200, $error = '')
{
    header('Content-type:text/json; charset=utf-8');
    $payload = array(
        'data'  => $data,
        'code'  => $code,
        'error' => $error
    );
    if (!empty($GLOBALS['MC_RESPONSE_META']) && is_array($GLOBALS['MC_RESPONSE_META'])) {
        foreach ($GLOBALS['MC_RESPONSE_META'] as $key => $value) {
            if (!array_key_exists($key, $payload)) {
                $payload[$key] = $value;
            }
        }
    }
    echo json_encode($payload);
    exit();
}
