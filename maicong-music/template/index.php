<?php
/**
 *
 * 音乐搜索器 - 模版文件
 *
 * @author  MaiCong <i@maicong.me>
 * @link    https://github.com/maicong/music
 * @since   1.5.10
 *
 */

if (!defined('MC_CORE')) {
    header("Location: /");
    exit();
}
?><!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>RyanMusic - 网易云 · QQ 音乐搜索</title>
    <meta name="renderer" content="webkit">
    <meta name="referrer" content="no-referrer">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta http-equiv="Cache-Control" content="no-transform">
    <meta http-equiv="Cache-Control" content="no-siteapp">
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
    <meta name="author" content="maicong.me">
    <meta name="keywords" content="RyanMusic,音乐搜索,网易云音乐,QQ音乐,音乐试听,音乐在线听">
    <meta name="description" content="RyanMusic — 网易云音乐与 QQ 音乐搜索、试听与下载。">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black">
    <meta name="apple-mobile-web-app-title" content="RyanMusic">
    <meta name="application-name" content="RyanMusic">
    <meta name="format-detection" content="telephone=no">
    <link rel="shortcut icon" href="favicon.ico">
    <link rel="apple-touch-icon" href="static/img/apple-touch-icon.png">
    <link rel="stylesheet" href="static/vendor/amazeui/amazeui.min.css">
    <link rel="stylesheet" href="static/css/style.css?v=<?php echo MC_VERSION; ?>">
</head>
<body class="theme-apple-glass">
    <div class="light-flow" aria-hidden="true">
        <span class="light-flow__orb light-flow__orb--1"></span>
        <span class="light-flow__orb light-flow__orb--2"></span>
        <span class="light-flow__orb light-flow__orb--3"></span>
        <span class="light-flow__beam"></span>
    </div>
    <!--[if lte IE 9]>
        <script type="text/javascript">
            (function(){
                var t = '你的浏览器也太挫了吧！大佬换一个噻！';
                document.body.innerHTML = t;
                document.body.style.fontSize = '66px';
                document.body.style.textAlign = 'center';
                document.body.style.background = '#000';
                document.body.style.color = '#fff';
                if (prompt('输入代号 666666 销毁此电脑: ', '') === '666666') {
                    alert('拜拜了您呢~')
                } else {
                    alert('总感觉哪里不对');
                }
                window.open('', '_self', '');
                window.close();
            })();
        </script>
    <![endif]-->
    <section class="am-g about">
        <div class="am-container am-margin-vertical-xl">
            <header class="hero-poster" aria-label="RyanMusic">
                <div class="hero-poster__bg" aria-hidden="true">
                    <span class="hero-poster__watermark">听</span>
                    <span class="hero-poster__watermark hero-poster__watermark--2">乐</span>
                </div>
                <div class="hero-poster__content">
                    <h1 class="hero-poster__title">
                        <span class="hero-poster__stroke" aria-hidden="true">RYAN</span>
                        <span class="hero-poster__line">RYAN</span>
                        <span class="hero-poster__line hero-poster__line--accent">MUSIC</span>
                    </h1>
                    <div class="hero-poster__ribbon">
                        <span>搜</span><span>听</span><span>下</span>
                    </div>
                </div>
            </header>
            <div class="am-u-lg-12 am-padding-vertical">
                <form id="j-validator" class="am-form am-margin-bottom-lg glass-panel" method="post">
                    <div class="am-u-md-12 am-u-sm-centered">
                        <ul id="j-nav" class="am-nav am-nav-pills am-nav-justify am-margin-bottom music-tabs">
                            <li class="am-active" data-filter="name">
                                <a>音乐名称</a>
                            </li>
                            <li data-filter="id">
                                <a>音乐 ID</a>
                            </li>
                            <li data-filter="url">
                                <a>音乐地址</a>
                            </li>
                        </ul>
                        <div class="am-form-group">
                            <input id="j-input" data-filter="name" class="am-form-field am-input-lg am-text-center am-radius" placeholder="例如: 不要说话 陈奕迅" data-am-loading="{loadingText: ' '}" pattern="^.+$" required>
                            <div class="am-alert am-alert-danger am-animation-shake"></div>
                        </div>
                        <div id="j-type" class="am-form-group am-text-center music-type">
                        <?php foreach ($music_type_list as $key => $val) { ?>
                            <label class="am-radio-inline">
                                <input type="radio" name="music_type" value="<?php echo $key; ?>"<?php if ($key === 'netease') echo ' checked'; ?>>
                                <?php echo $val; ?>
                            </label>
                        <?php } ?>
                        </div>
                        <button id="j-submit" type="submit" class="am-btn am-btn-primary am-btn-lg am-btn-block am-radius" data-am-loading="{spinner: 'off', loadingText: '搜索中...', resetText: '搜索'}">搜索</button>
                        <div id="j-search-progress" class="search-progress" aria-hidden="true" role="status" aria-live="polite">
                            <div class="search-progress__track">
                                <div id="j-search-progress-bar" class="search-progress__bar"></div>
                            </div>
                            <p class="search-progress__meta">
                                <span id="j-search-progress-label">正在搜索…</span>
                                <span id="j-search-progress-time" class="search-progress__time">已等待 0 秒</span>
                            </p>
                            <p id="j-search-progress-hint" class="search-progress__hint">通常需要 5–15 秒，请稍候</p>
                        </div>
                    </div>
                </form>
                <form id="j-main" class="am-form am-u-md-12 am-u-sm-centered music-main glass-panel">
                    <button type="button" id="j-back" class="result-back" aria-label="返回继续搜索">
                        <span class="result-back__spinner" aria-hidden="true"></span>
                        <span class="result-back__label">
                            <span class="result-back__icon" aria-hidden="true">←</span>
                            <span class="result-back__text">继续搜索</span>
                        </span>
                    </button>

                    <div id="j-show" class="result-player result-player--studio">
                        <div id="j-player" class="aplayer"></div>
                    </div>
                    <button type="button" id="j-load-more" class="result-load-more" hidden>加载更多</button>

                    <section class="result-meta" aria-label="曲目详情">
                        <div class="meta-card">
                            <span class="meta-card__label"><i class="am-icon-download am-icon-fw"></i>下载地址</span>
                            <div class="meta-card__body">
                                <input id="j-src" class="meta-card__input" readonly>
                                <a id="j-src-btn" class="meta-card__action" title="下载音频">
                                    <i id="j-src-btn-icon" class="am-icon-download"></i>
                                </a>
                            </div>
                        </div>
                        <div class="meta-card meta-card--lrc">
                            <span class="meta-card__label"><i class="am-icon-file-text-o am-icon-fw"></i>歌词</span>
                            <div class="meta-card__body meta-card__body--lrc">
                                <pre id="j-lrc" class="meta-card__lrc-text"></pre>
                                <a id="j-lrc-btn" class="meta-card__action" target="_blank" rel="noopener" title="下载歌词">
                                    <i id="j-lrc-btn-icon" class="am-icon-external-link"></i>
                                </a>
                            </div>
                        </div>
                    </section>
                </form>
            </div>
        </div>
    </section>
    <footer class="footer">
        <p class="am-text-sm">v<?php echo MC_VERSION; ?>&nbsp;&copy;&nbsp;<?php echo date('Y'); ?>&nbsp;<a href="help.php">使用帮助</a>&nbsp;·&nbsp;<a href="disclaimer.php">免责声明</a>&nbsp;·&nbsp;<a href="mailto:17625416243@163.com">联系站长</a></p>
    </footer>
    <script src="static/vendor/jquery/jquery.min.js"></script>
    <script src="static/vendor/amazeui/amazeui.min.js"></script>
    <script src="static/vendor/aplayer/APlayer.min.js"></script>
    <script src="static/vendor/base64/base64.min.js"></script>
    <script src="static/js/music.js?v=<?php echo MC_VERSION; ?>"></script>
</body>
</html>
