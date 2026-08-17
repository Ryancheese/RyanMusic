<?php

define('MC_CORE', true);
define('MC_DEBUG', 0);
define('MC_CORE_DIR', __DIR__ . '/../maicong-music/core');

require __DIR__ . '/../maicong-music/core/music.php';

if (!function_exists('mc_netease_lyric_text')) {
    fwrite(STDERR, "Expected mc_netease_lyric_text to exist.\n");
    exit(1);
}

function assert_same($expected, $actual, $label)
{
    if ($expected !== $actual) {
        fwrite(STDERR, $label . "\nExpected: " . var_export($expected, true) . "\nActual: " . var_export($actual, true) . "\n");
        exit(1);
    }
}

$payload = [
    'lrc' => ['lyric' => "[00:01.00]hello"],
    'yrc' => ['lyric' => "[1000,2000](1000,200,0)hello"],
    'tlyric' => ['lyric' => "[00:01.00]你好"],
    'ytlrc' => ['lyric' => "[00:01.00]逐字翻译"],
];

assert_same("[00:01.00]hello", mc_netease_lyric_text($payload, 'lrc'), 'Should keep standard LRC.');
assert_same("[1000,2000](1000,200,0)hello", mc_netease_lyric_text($payload, 'yrc'), 'Should prefer YRC when present.');
assert_same("[00:01.00]逐字翻译", mc_netease_lyric_text($payload, 'tlyric'), 'Should prefer word-level translation with YRC.');
assert_same('', mc_netease_lyric_text(null, 'yrc'), 'Missing payload should be empty.');

fwrite(STDOUT, "netease lyric payload tests passed\n");
