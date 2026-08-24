<?php

define('MC_CORE', true);
define('MC_DEBUG', 0);
define('MC_CORE_DIR', __DIR__ . '/../web-root/core');

require __DIR__ . '/../web-root/core/music.php';

if (!function_exists('mc_name_search_source_page') || !function_exists('mc_slice_name_search_songids')) {
    fwrite(STDERR, "Expected name search paging helpers to exist.\n");
    exit(1);
}

function assert_same($expected, $actual, $label)
{
    if ($expected !== $actual) {
        fwrite(STDERR, $label . "\nExpected: " . var_export($expected, true) . "\nActual: " . var_export($actual, true) . "\n");
        exit(1);
    }
}

$ten_songids = range(1, 10);

assert_same(1, mc_name_search_source_page(1), 'First client page should read source page 1.');
assert_same(
    ['songids' => [1, 2, 3], 'has_more' => true],
    mc_slice_name_search_songids($ten_songids, 1),
    'First client page should return the first 3 source results.'
);

assert_same(1, mc_name_search_source_page(2), 'Second client page should still read source page 1.');
assert_same(
    ['songids' => [4, 5, 6, 7, 8, 9, 10], 'has_more' => true],
    mc_slice_name_search_songids($ten_songids, 2),
    'Second client page should return the remaining 7 source results.'
);

assert_same(2, mc_name_search_source_page(3), 'Third client page should read source page 2.');
assert_same(
    ['songids' => range(11, 20), 'has_more' => true],
    mc_slice_name_search_songids(range(11, 20), 3),
    'Third client page should return a normal full source page.'
);

assert_same(
    ['songids' => [1, 2], 'has_more' => false],
    mc_slice_name_search_songids([1, 2], 1),
    'Short first page should not advertise more results.'
);

assert_same(
    ['songids' => [4, 5], 'has_more' => false],
    mc_slice_name_search_songids([1, 2, 3, 4, 5], 2),
    'Short second page should only return available remaining results.'
);

echo "name search paging tests passed\n";
