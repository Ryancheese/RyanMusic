<?php
if (!defined('MC_CORE')) {
    header('Location: /');
    exit();
}
?><!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>使用帮助 - RyanMusic</title>
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
                <h1 class="help-page__title">使用帮助</h1>
                <p><b>标红</b> 为 <strong>音乐 ID</strong>，<u>下划线</u> 表示 <strong>音乐地址</strong></p>
                <h2 class="help-page__h2">搜索方式</h2>
                <ul>
                    <li><strong>音乐名称</strong>：输入歌名与歌手，例如 <code>普通朋友 陶喆</code></li>
                    <li><strong>音乐 ID</strong>：输入平台歌曲 ID</li>
                    <li><strong>音乐地址</strong>：粘贴歌曲页面完整链接</li>
                </ul>
                <h2 class="help-page__h2">支持平台</h2>
                <p>当前支持 <strong>网易云音乐</strong> 与 <strong>QQ 音乐</strong>，搜索前请在首页选择对应平台。</p>
                <h2 class="help-page__h2">地址示例</h2>
                <blockquote class="help-page__quote">
                    <p><span>网易：</span><u>http://music.163.com/#/song?id=<b>150623</b></u></p>
                    <p><span>ＱＱ：</span><u>https://y.qq.com/n/yqq/song/<b>0044SaFh0apuR2</b>.html</u></p>
                </blockquote>
                <h2 class="help-page__h2">播放与下载</h2>
                <ul>
                    <li>搜索成功后可在线试听，部分歌曲因版权可能无法播放</li>
                    <li>结果页可查看播放地址与歌词，并支持下载（视浏览器与资源而定）</li>
                </ul>
            </article>
        </div>
    </section>
    <footer class="footer">
        <p class="am-text-sm">v<?php echo MC_VERSION; ?>&nbsp;&copy;&nbsp;<?php echo date('Y'); ?>&nbsp;<a href="./">RyanMusic</a>&nbsp;·&nbsp;<a href="disclaimer.php">免责声明</a></p>
    </footer>
    <script src="//cdn.staticfile.org/jquery/1.11.1/jquery.min.js"></script>
    <script src="static/js/music.js?v=<?php echo MC_VERSION; ?>"></script>
</body>
</html>
