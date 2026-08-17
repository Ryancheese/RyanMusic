<?php
/**
 * RyanMusic SPA 入口（Folia 风格前端）
 * 若尚未构建 web/，则回退到经典模板。
 */
if (!defined('MC_CORE')) {
    header('Location: /');
    exit();
}

$manifestFile = dirname(__DIR__) . '/static/app/manifest.json';
if (!is_file($manifestFile)) {
    $manifestFile = dirname(__DIR__) . '/static/app/.vite/manifest.json';
}
if (!is_file($manifestFile)) {
    include __DIR__ . '/index-classic.php';
    return;
}

$manifest = json_decode((string) file_get_contents($manifestFile), true);
$entry = is_array($manifest) ? ($manifest['index.html'] ?? null) : null;
if (!$entry || empty($entry['file'])) {
    include __DIR__ . '/index-classic.php';
    return;
}

$assetBase = 'static/app/';
$scriptFile = $assetBase . $entry['file'];
$cssFiles = isset($entry['css']) && is_array($entry['css']) ? $entry['css'] : array();
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>RyanMusic - 网易云 · QQ 音乐搜索</title>
    <meta name="renderer" content="webkit">
    <meta name="referrer" content="no-referrer">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="keywords" content="RyanMusic,音乐搜索,网易云音乐,QQ音乐,音乐试听">
    <meta name="description" content="RyanMusic — 网易云音乐与 QQ 音乐搜索、试听与下载。">
    <meta name="apple-mobile-web-app-title" content="RyanMusic">
    <link rel="shortcut icon" href="favicon.ico">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<?php foreach ($cssFiles as $cssFile): ?>
    <link rel="stylesheet" href="<?php echo htmlspecialchars($assetBase . $cssFile, ENT_QUOTES, 'UTF-8'); ?>">
<?php endforeach; ?>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="<?php echo htmlspecialchars($scriptFile, ENT_QUOTES, 'UTF-8'); ?>"></script>
</body>
</html>
