<?php
/**
 * 音乐资源代理（QQ / 网易 播放链等）
 */

define('MC_CORE', true);
define('MC_VERSION', '1.7.8');
define('MC_CORE_DIR', __DIR__ . '/core');
define('MC_TEMP_DIR', __DIR__ . '/template');
define('MC_DEBUG', 0);
define('MC_PROXY', false);
define('MC_PROXYUSERPWD', false);
define('MC_INTERNAL', 1);
define('MC_QQ_PYQ_BOOTSTRAP', 'https://music.90svip.cn/');
define('MC_API_SECRET', '');

if (!extension_loaded('curl')) {
    header('HTTP/1.1 500 Internal Server Error');
    exit('Curl required');
}

require MC_CORE_DIR . '/music.php';

mc_api_handle_request();
