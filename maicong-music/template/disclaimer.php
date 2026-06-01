<?php
if (!defined('MC_CORE')) {
    header('Location: /');
    exit();
}
?><!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>免责声明 - RyanMusic</title>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
    <meta name="robots" content="noindex">
    <link rel="shortcut icon" href="favicon.ico">
    <link rel="stylesheet" href="//cdn.staticfile.org/amazeui/2.3.0/css/amazeui.min.css">
    <link rel="stylesheet" href="static/css/style.css?v=<?php echo MC_VERSION; ?>">
</head>
<body class="theme-apple-glass help-page">
    <div class="light-flow" aria-hidden="true">
        <span class="light-flow__orb light-flow__orb--1"></span>
        <span class="light-flow__orb light-flow__orb--2"></span>
        <span class="light-flow__orb light-flow__orb--3"></span>
        <span class="light-flow__beam"></span>
    </div>
    <section class="about help-page__wrap">
        <div class="am-container">
            <a href="./" class="help-page__back">← 返回搜索</a>
            <article class="music-tips glass-panel help-page__panel">
                <h1 class="help-page__title">免责声明</h1>
                <div class="disclaimer-block">
                    <?php include MC_TEMP_DIR . '/disclaimer-content.php'; ?>
                </div>
            </article>
        </div>
    </section>
    <footer class="footer">
        <p class="am-text-sm">v<?php echo MC_VERSION; ?>&nbsp;&copy;&nbsp;<?php echo date('Y'); ?>&nbsp;<a href="./">RyanMusic</a>&nbsp;·&nbsp;<a href="help.php">使用帮助</a></p>
    </footer>
    <script src="//cdn.staticfile.org/jquery/1.11.1/jquery.min.js"></script>
</body>
</html>
