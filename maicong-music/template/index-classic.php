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
        <span class="light-flow__bloom"></span>
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
    <header class="site-chrome" id="j-site-chrome" aria-label="RyanMusic">
        <button
            type="button"
            class="site-chrome__logo"
            id="j-logo-toggle"
            aria-expanded="false"
            aria-controls="j-ambient-controls"
            title="点击展开光影设置"
        >
            <h1 class="site-chrome__title">
                <span class="site-chrome__line">RYAN</span>
                <span class="site-chrome__line site-chrome__line--accent">MUSIC</span>
            </h1>
        </button>
        <div class="ambient-controls" id="j-ambient-controls" hidden aria-label="光影设置">
            <label class="ambient-intensity" title="背景光影亮度，0% 为关闭">
                <span class="ambient-intensity__label">亮度</span>
                <input
                    type="range"
                    id="j-ambient-brightness"
                    class="ambient-intensity__range"
                    min="0"
                    max="100"
                    step="1"
                    value="55"
                    aria-label="光影亮度，0% 为关闭"
                >
                <span id="j-ambient-brightness-val" class="ambient-intensity__val">55%</span>
            </label>
            <label class="ambient-intensity" title="随音乐律动的幅度">
                <span class="ambient-intensity__label">律动</span>
                <input
                    type="range"
                    id="j-ambient-motion"
                    class="ambient-intensity__range"
                    min="0"
                    max="100"
                    step="1"
                    value="80"
                    aria-label="律动幅度"
                >
                <span id="j-ambient-motion-val" class="ambient-intensity__val">80%</span>
            </label>
            <label class="ambient-intensity" title="背景与主题色的饱和度，与律动无关">
                <span class="ambient-intensity__label">饱和度</span>
                <input
                    type="range"
                    id="j-ambient-saturation"
                    class="ambient-intensity__range"
                    min="0"
                    max="100"
                    step="1"
                    value="85"
                    aria-label="颜色饱和度"
                >
                <span id="j-ambient-saturation-val" class="ambient-intensity__val">85%</span>
            </label>
        </div>
    </header>
<footer class="site-footer" aria-label="站点信息">
        <nav class="site-footer__links">
            <a href="help.php" data-modal="help">帮助</a>
            <a href="disclaimer.php" data-modal="disclaimer">声明</a>
            <a href="mailto:17625416243@163.com">联系</a>
        </nav>
        <span class="site-footer__ver">v<?php echo MC_VERSION; ?></span>
    </footer>

    <div class="site-modal" id="j-modal-help" hidden aria-hidden="true">
        <button type="button" class="site-modal__backdrop" data-modal-close aria-label="关闭"></button>
        <div class="site-modal__panel site-modal__panel--help" role="dialog" aria-modal="true" aria-labelledby="j-modal-help-title" tabindex="-1">
            <header class="site-modal__head">
                <h2 class="site-modal__title" id="j-modal-help-title">使用帮助</h2>
                <button type="button" class="site-modal__close" data-modal-close aria-label="关闭">×</button>
            </header>
            <div class="site-modal__body">
                <?php include MC_TEMP_DIR . '/help-content.php'; ?>
                <p class="site-modal__replay">
                    <button type="button" class="site-modal__link-btn" data-onboarding-replay>重新查看使用引导</button>
                </p>
            </div>
        </div>
    </div>

    <div class="site-modal" id="j-modal-disclaimer" hidden aria-hidden="true">
        <button type="button" class="site-modal__backdrop" data-modal-close aria-label="关闭"></button>
        <div class="site-modal__panel" role="dialog" aria-modal="true" aria-labelledby="j-modal-disclaimer-title" tabindex="-1">
            <header class="site-modal__head">
                <h2 class="site-modal__title" id="j-modal-disclaimer-title">免责声明</h2>
                <button type="button" class="site-modal__close" data-modal-close aria-label="关闭">×</button>
            </header>
            <div class="site-modal__body disclaimer-block">
                <?php include MC_TEMP_DIR . '/disclaimer-content.php'; ?>
            </div>
        </div>
    </div>

    <div class="site-modal" id="j-modal-netease" hidden aria-hidden="true">
        <button type="button" class="site-modal__backdrop" data-modal-close aria-label="关闭"></button>
        <div class="site-modal__panel site-modal__panel--netease" role="dialog" aria-modal="true" aria-labelledby="j-modal-netease-title" tabindex="-1">
            <header class="site-modal__head">
                <h2 class="site-modal__title" id="j-modal-netease-title">同步网易云</h2>
                <button type="button" class="site-modal__close" data-modal-close aria-label="关闭">×</button>
            </header>
            <div class="site-modal__body">
                <div id="j-ne-logged-out">
                    <p class="ne-sync__lead">用网易云 App 扫码登录，同步「我喜欢」与自建/收藏歌单。播放仍在 RyanMusic。</p>
                    <div class="ne-sync__qr-wrap">
                        <img id="j-ne-qr" class="ne-sync__qr" alt="网易云登录二维码" width="180" height="180">
                        <p id="j-ne-qr-status" class="ne-sync__status">正在生成二维码…</p>
                        <button type="button" class="ne-sync__btn ne-sync__btn--ghost" id="j-ne-qr-refresh">刷新二维码</button>
                    </div>
                    <details class="ne-sync__cookie">
                        <summary>扫码不行？改用 Cookie</summary>
                        <p class="ne-sync__hint">浏览器登录 <code>music.163.com</code> → 开发者工具 → Network → 任意请求 → 复制请求头里的 Cookie（需含 <code>MUSIC_U</code>）。Cookie 仅存本机，退出即删除。</p>
                        <textarea id="j-ne-cookie" class="ne-sync__textarea" rows="4" placeholder="粘贴 Cookie…" spellcheck="false"></textarea>
                        <button type="button" class="ne-sync__btn" id="j-ne-cookie-save">保存并登录</button>
                    </details>
                </div>
                <div id="j-ne-logged-in" hidden>
                    <p class="ne-sync__user">已登录：<strong id="j-ne-nickname">—</strong></p>
                    <p class="ne-sync__hint">登录态保存在本机。同步不会覆盖左侧「喜欢」列表。</p>
                    <div class="ne-sync__actions">
                        <button type="button" class="ne-sync__btn" id="j-ne-do-sync">同步歌单</button>
                        <button type="button" class="ne-sync__btn ne-sync__btn--ghost" id="j-ne-logout">退出登录</button>
                    </div>
                    <p id="j-ne-sync-msg" class="ne-sync__status" aria-live="polite"></p>
                </div>
            </div>
        </div>
    </div>

    <div class="site-modal" id="j-modal-qq" hidden aria-hidden="true">
        <button type="button" class="site-modal__backdrop" data-modal-close aria-label="关闭"></button>
        <div class="site-modal__panel site-modal__panel--qq" role="dialog" aria-modal="true" aria-labelledby="j-modal-qq-title" tabindex="-1">
            <header class="site-modal__head">
                <h2 class="site-modal__title" id="j-modal-qq-title">同步 QQ 音乐</h2>
                <button type="button" class="site-modal__close" data-modal-close aria-label="关闭">×</button>
            </header>
            <div class="site-modal__body">
                <div id="j-qq-logged-out">
                    <p class="ne-sync__lead">用 QQ / 微信扫码登录 QQ 音乐，同步「我喜欢」与自建/收藏歌单。播放仍在 RyanMusic。</p>
                    <div class="ne-sync__qr-wrap">
                        <img id="j-qq-qr" class="ne-sync__qr" alt="QQ 音乐登录二维码" width="180" height="180">
                        <p id="j-qq-qr-status" class="ne-sync__status">正在生成二维码…</p>
                        <button type="button" class="ne-sync__btn ne-sync__btn--ghost" id="j-qq-qr-refresh">刷新二维码</button>
                    </div>
                    <details class="ne-sync__cookie">
                        <summary>扫码不行？改用 Cookie</summary>
                        <p class="ne-sync__hint">浏览器登录 <code>y.qq.com</code> → 开发者工具 → Network → 任意请求 → 复制请求头里的 Cookie（需含 <code>uin</code> 与 <code>qm_keyst</code>）。Cookie 仅存本机，退出即删除。</p>
                        <textarea id="j-qq-cookie" class="ne-sync__textarea" rows="4" placeholder="粘贴 Cookie…" spellcheck="false"></textarea>
                        <button type="button" class="ne-sync__btn" id="j-qq-cookie-save">保存并登录</button>
                    </details>
                </div>
                <div id="j-qq-logged-in" hidden>
                    <p class="ne-sync__user">已登录：<strong id="j-qq-nickname">—</strong></p>
                    <p class="ne-sync__hint">登录态保存在本机。同步不会覆盖左侧「喜欢」列表。</p>
                    <div class="ne-sync__actions">
                        <button type="button" class="ne-sync__btn" id="j-qq-do-sync">同步歌单</button>
                        <button type="button" class="ne-sync__btn ne-sync__btn--ghost" id="j-qq-logout">退出登录</button>
                    </div>
                    <p id="j-qq-sync-msg" class="ne-sync__status" aria-live="polite"></p>
                </div>
            </div>
        </div>
    </div>

    <div
        id="j-onboarding"
        class="onboarding"
        hidden
        aria-hidden="true"
        role="dialog"
        aria-modal="true"
        aria-labelledby="j-onboarding-title"
        aria-describedby="j-onboarding-desc"
    >
        <div class="onboarding__veil" aria-hidden="true"></div>
        <div class="onboarding__spotlight" id="j-onboarding-spot" aria-hidden="true"></div>
        <div class="onboarding__ring" id="j-onboarding-ring" aria-hidden="true"></div>
        <div class="onboarding__card" tabindex="-1">
            <div class="onboarding__glow" aria-hidden="true"></div>
            <div class="onboarding__art" id="j-onboarding-art" data-art="welcome" aria-hidden="true">
                <div class="onboarding-art onboarding-art--welcome">
                    <span class="onboarding-art__orbit"></span>
                    <span class="onboarding-art__orbit onboarding-art__orbit--2"></span>
                    <span class="onboarding-art__vinyl"></span>
                    <span class="onboarding-art__core"></span>
                    <span class="onboarding-art__note onboarding-art__note--1">♪</span>
                    <span class="onboarding-art__note onboarding-art__note--2">♫</span>
                </div>
                <div class="onboarding-art onboarding-art--search">
                    <span class="onboarding-art__bar"></span>
                    <span class="onboarding-art__cursor"></span>
                    <span class="onboarding-art__ripple"></span>
                </div>
                <div class="onboarding-art onboarding-art--source">
                    <span class="onboarding-art__chip onboarding-art__chip--a">网易</span>
                    <span class="onboarding-art__swap"></span>
                    <span class="onboarding-art__chip onboarding-art__chip--b">QQ</span>
                </div>
                <div class="onboarding-art onboarding-art--library">
                    <span class="onboarding-art__rail"></span>
                    <span class="onboarding-art__row onboarding-art__row--1"></span>
                    <span class="onboarding-art__row onboarding-art__row--2"></span>
                    <span class="onboarding-art__row onboarding-art__row--3"></span>
                    <span class="onboarding-art__heart">♥</span>
                </div>
                <div class="onboarding-art onboarding-art--play">
                    <span class="onboarding-art__disc"></span>
                    <span class="onboarding-art__eq">
                        <i></i><i></i><i></i><i></i><i></i>
                    </span>
                    <span class="onboarding-art__like">♡</span>
                </div>
                <div class="onboarding-art onboarding-art--download">
                    <span class="onboarding-art__sheet"></span>
                    <span class="onboarding-art__arrow"></span>
                    <span class="onboarding-art__tray"></span>
                </div>
                <div class="onboarding-art onboarding-art--ambient">
                    <span class="onboarding-art__blob onboarding-art__blob--1"></span>
                    <span class="onboarding-art__blob onboarding-art__blob--2"></span>
                    <span class="onboarding-art__blob onboarding-art__blob--3"></span>
                    <span class="onboarding-art__knob"></span>
                </div>
                <div class="onboarding-art onboarding-art--finish">
                    <span class="onboarding-art__check"></span>
                    <span class="onboarding-art__spark onboarding-art__spark--1"></span>
                    <span class="onboarding-art__spark onboarding-art__spark--2"></span>
                    <span class="onboarding-art__spark onboarding-art__spark--3"></span>
                </div>
            </div>
            <div class="onboarding__progress" id="j-onboarding-dots" aria-hidden="true"></div>
            <p class="onboarding__eyebrow" id="j-onboarding-step">引导 1 / 8</p>
            <h2 class="onboarding__title" id="j-onboarding-title">欢迎</h2>
            <p class="onboarding__desc" id="j-onboarding-desc"></p>
            <div class="onboarding__actions">
                <button type="button" class="onboarding__btn onboarding__btn--ghost" id="j-onboarding-skip">跳过</button>
                <button type="button" class="onboarding__btn onboarding__btn--primary" id="j-onboarding-next">下一步</button>
            </div>
        </div>
    </div>

    <section class="app-stage" aria-label="主内容">
        <div class="app-stage__row">
            <aside id="j-library" class="local-library glass-panel" aria-label="我的音乐">
                <div class="local-library__head">
                    <h2 class="local-library__title">我的音乐</h2>
                    <div class="local-library__sync-group">
                        <button type="button" class="local-library__sync" id="j-netease-sync-btn" data-modal="netease" title="同步网易云歌单">同步网易云</button>
                        <button type="button" class="local-library__sync" id="j-qq-sync-btn" data-modal="qq" title="同步 QQ 音乐歌单">同步QQ</button>
                    </div>
                </div>
                <div class="local-library__channels" role="tablist" aria-label="音源渠道">
                    <button type="button" class="local-library__chip is-active" data-channel="all">全部</button>
                    <button type="button" class="local-library__chip" data-channel="netease">网易云</button>
                    <button type="button" class="local-library__chip" data-channel="qq">QQ</button>
                </div>
                <div class="local-library__tabs" role="tablist" aria-label="本地列表">
                    <button type="button" class="local-library__tab is-active" data-tab="liked">喜欢</button>
                    <button type="button" class="local-library__tab" data-tab="recent">最近</button>
                    <button type="button" class="local-library__tab" data-tab="playlist">播放列表</button>
                    <button type="button" class="local-library__tab" data-tab="cloud">网易云</button>
                    <button type="button" class="local-library__tab" data-tab="qqcloud">QQ</button>
                </div>
                <div class="local-library__cloud-bar" id="j-cloud-bar" hidden>
                    <button type="button" class="local-library__cloud-back" id="j-cloud-back">← 返回歌单</button>
                    <span class="local-library__cloud-title" id="j-cloud-title"></span>
                </div>
                <div class="local-library__scroll">
                    <ul id="j-library-list" class="local-library__list"></ul>
                    <p id="j-library-empty" class="local-library__empty">还没有内容。播放后点红心即可收藏。</p>
                </div>
            </aside>

            <div class="app-stage__main">
                <div class="stage-shell glass-panel">
                    <form id="j-validator" class="am-form stage-shell__search" method="post">
                        <div class="am-u-md-12 am-u-sm-centered">
                            <div class="am-form-group search-bar-group">
                                <div class="search-bar" id="j-search-bar">
                                    <span class="search-bar__icon" aria-hidden="true">
                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <circle cx="11" cy="11" r="7"></circle>
                                            <path d="M20 20l-3.5-3.5"></path>
                                        </svg>
                                    </span>
                                    <input id="j-input" data-filter="name" class="am-form-field am-input-lg search-bar__input" placeholder="搜索音乐，歌手" data-am-loading="{loadingText: ' '}" pattern="^.+$" required aria-label="搜索音乐，歌手">
                                    <div id="j-type" class="search-bar__source">
                                        <input type="radio" name="music_type" value="netease" checked class="is-visually-hidden" tabindex="-1">
                                        <input type="radio" name="music_type" value="qq" class="is-visually-hidden" tabindex="-1">
                                        <button type="button" id="j-source-toggle" class="source-toggle is-netease" title="当前网易，点击切换到 QQ" aria-label="切换音源">
                                            <span class="source-toggle__text">网易</span>
                                        </button>
                                    </div>
                                    <button id="j-submit" type="submit" class="am-btn am-btn-primary search-bar__submit" data-am-loading="{spinner: 'off', loadingText: '…', resetText: '搜索'}">搜索</button>
                                </div>
                                <div class="am-alert am-alert-danger am-animation-shake"></div>
                            </div>
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

                    <div id="j-search-browse" class="search-browse" hidden>
                        <div class="search-browse__head">
                            <p class="search-browse__title">搜索结果</p>
                            <p class="search-browse__hint">点击歌曲开始播放，当前音乐将继续播放</p>
                        </div>
                        <div class="search-browse__scroll">
                            <ol id="j-search-browse-list" class="search-browse__list"></ol>
                        </div>
                        <p id="j-search-browse-status" class="search-browse__status" hidden></p>
                    </div>

                    <div id="j-stage-empty" class="stage-empty" aria-label="RyanMusic">
                        <div class="stage-empty__glow" aria-hidden="true"></div>
                        <div class="stage-empty__mark" aria-hidden="true">
                            <svg class="stage-empty__vinyl" viewBox="0 0 120 120" width="120" height="120">
                                <defs>
                                    <radialGradient id="stageEmptyDisc" cx="50%" cy="50%" r="50%">
                                        <stop offset="0%" stop-color="rgba(255,255,255,0.14)"/>
                                        <stop offset="42%" stop-color="rgba(20,20,28,0.2)"/>
                                        <stop offset="100%" stop-color="rgba(250,45,85,0.35)"/>
                                    </radialGradient>
                                </defs>
                                <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
                                <circle cx="60" cy="60" r="42" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
                                <circle cx="60" cy="60" r="30" fill="none" stroke="rgba(250,45,85,0.35)" stroke-width="1.25"/>
                                <circle cx="60" cy="60" r="18" fill="url(#stageEmptyDisc)"/>
                                <circle cx="60" cy="60" r="6" fill="var(--accent, #fa2d55)"/>
                            </svg>
                            <span class="stage-empty__pulse"></span>
                        </div>
                        <p class="stage-empty__brand">
                            <span class="stage-empty__line">RYAN</span><span class="stage-empty__line stage-empty__line--accent">MUSIC</span>
                        </p>
                        <p class="stage-empty__hint">搜索一首歌，开始聆听</p>
                    </div>

                    <div id="j-main" class="music-main stage-shell__result">
                        <div class="result-toolbar">
                            <button type="button" id="j-like-btn" class="like-btn" aria-pressed="false" title="喜欢">
                                <span class="like-btn__icon" aria-hidden="true">♡</span>
                                <span class="like-btn__text">喜欢</span>
                            </button>
                            <button type="button" id="j-add-playlist-btn" class="like-btn like-btn--playlist" title="加入播放列表">
                                <span class="like-btn__icon" aria-hidden="true">＋</span>
                                <span class="like-btn__text">加入播放列表</span>
                            </button>
                            <span id="j-track-channel" class="track-channel" hidden></span>
                        </div>

                        <div id="j-show" class="result-player result-player--studio">
                            <div class="player-dl-actions">
                                <a id="j-src-btn" class="player-dl-btn" href="#" title="下载歌曲">下载歌曲</a>
                                <a id="j-lrc-btn" class="player-dl-btn" href="#" title="下载歌词">下载歌词</a>
                            </div>
                            <div id="j-player" class="aplayer"></div>
                            <p id="j-load-status" class="playlist-load-status" hidden aria-live="polite"></p>
                            <!-- 供下载逻辑读写，不展示 -->
                            <input id="j-src" type="hidden" value="">
                            <pre id="j-lrc" class="is-visually-hidden" hidden></pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
    <script src="static/vendor/jquery/jquery.min.js"></script>
    <script src="static/vendor/amazeui/amazeui.min.js"></script>
    <script src="static/vendor/aplayer/APlayer.min.js"></script>
    <script src="static/vendor/base64/base64.min.js"></script>
    <script src="static/js/music.js?v=<?php echo MC_VERSION; ?>"></script>
</body>
</html>
