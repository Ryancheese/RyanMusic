'use strict';

/**
 *
 * 音乐搜索器 - JS 文件
 *
 * @author  MaiCong <i@maicong.me>
 * @link    https://github.com/maicong/music
 * @since   1.5.9
 *
 */

function patchAPlayerAuthorDisplay() {
  if (!window.APlayer || APlayer.prototype._authorDisplayPatched) return;

  var origSetMusic = APlayer.prototype.setMusic;
  if (typeof origSetMusic !== 'function') return;

  APlayer.prototype._authorDisplayPatched = true;
  APlayer.prototype.setMusic = function(index) {
    origSetMusic.apply(this, arguments);
    var authorEl = this.element.getElementsByClassName('aplayer-author')[0];
    if (authorEl && this.music && this.music.author) {
      authorEl.textContent = this.music.author;
    }
  };

  var origAddMusic = APlayer.prototype.addMusic;
  if (typeof origAddMusic === 'function') {
    APlayer.prototype.addMusic = function(tracks) {
      origAddMusic.apply(this, arguments);
      var list = this.element.getElementsByClassName('aplayer-list')[0];
      if (list) {
        list.classList.remove('aplayer-list-hide');
        list.style.height = 'auto';
        list.style.maxHeight = 'none';
        list.style.overflow = 'visible';
      }
    };
  }
}

$(function() {
  patchAPlayerAuthorDisplay();
  // 获取参数
  function q(key) {
    var value = null;
    var tmp = [];
    location.search
      .substr(1)
      .split('&')
      .forEach(function(v) {
        tmp = v.split('=');
        if (tmp[0] === key) {
          value = decodeURIComponent(tmp[1]);
        }
      });
    return value;
  }

  // 加入历史记录
  function pushState(title, link) {
    if (window.history && window.history.pushState) {
      window.history.pushState(null, title, link);
    }
  }

  // 获取 url
  function getUrl(path) {
    var url = location.href.split('?')[0];
    return path ? url + path : url;
  }

  // 申明变量
  var player = null;
  var playerList = [];
  var nopic = 'static/img/nopic.jpg';
  var qName = q('name');
  var qId = q('id');
  var qUrl = q('url');
  var qType = q('type');
  var siteTitle = document.title;
  var searchTabHolder = {
    name: '例如: 不要说话 陈奕迅',
    id: '例如: 25906124',
    url: '例如: http://music.163.com/#/song?id=25906124',
    pattern_name: '^.+$',
    pattern_id: '^[\\w\\/\\|]+$',
    pattern_url: '^https?:\\/\\/\\S+$'
  };
  var LRC_LINE_HEIGHT = 32;
  var LRC_VISIBLE_LINES = 3;
  var LRC_CENTER_OFFSET = LRC_LINE_HEIGHT * ((LRC_VISIBLE_LINES - 1) / 2);
  var LRC_SCROLL_TRANSITION =
    'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)';
  var SEARCH_TIMEOUT_MS = 30000;
  var SEARCH_TYPICAL_MS = 12000;
  var searchProgressTimer = null;
  var searchProgressOk = false;

  function calcSearchProgressPercent(elapsedMs) {
    var t = Math.min(elapsedMs / SEARCH_TIMEOUT_MS, 1);
    return Math.min(92, Math.round((1 - Math.pow(1 - t, 2.2)) * 92));
  }

  function formatSearchWaitHint(elapsedSec) {
    if (elapsedSec < 2) {
      return '通常需要 5–15 秒，请稍候';
    }
    if (elapsedSec >= 25) {
      return '即将达到 30 秒上限，若仍无响应请检查网络后重试';
    }
    var remain = Math.max(1, Math.ceil(SEARCH_TYPICAL_MS / 1000 - elapsedSec));
    return '预计还需约 ' + remain + ' 秒（多数请求在 15 秒内完成）';
  }

  function startSearchProgress() {
    stopSearchProgress(false);
    var $box = $('#j-search-progress');
    if (!$box.length) return;

    var startAt = Date.now();
    searchProgressOk = false;
    $box.addClass('is-active').attr('aria-hidden', 'false');
    $('#j-search-progress-bar').css('width', '0%');
    $('#j-search-progress-label').text('正在搜索…');
    $('#j-search-progress-time').text('已等待 0 秒');
    $('#j-search-progress-hint').text(formatSearchWaitHint(0));

    searchProgressTimer = setInterval(function() {
      var elapsed = Date.now() - startAt;
      var sec = Math.floor(elapsed / 1000);
      var pct = calcSearchProgressPercent(elapsed);
      $('#j-search-progress-bar').css('width', pct + '%');
      $('#j-search-progress-time').text('已等待 ' + sec + ' 秒');
      $('#j-search-progress-hint').text(formatSearchWaitHint(sec));
    }, 120);
  }

  function stopSearchProgress(done) {
    if (searchProgressTimer) {
      clearInterval(searchProgressTimer);
      searchProgressTimer = null;
    }
    var $box = $('#j-search-progress');
    if (!$box.length) return;

    if (done) {
      $('#j-search-progress-bar').css('width', '100%');
      $('#j-search-progress-label').text('搜索完成');
      $('#j-search-progress-hint').text('正在展示结果…');
      setTimeout(function() {
        $box.removeClass('is-active').attr('aria-hidden', 'true');
        $('#j-search-progress-bar').css('width', '0%');
      }, 400);
    } else {
      $box.removeClass('is-active').attr('aria-hidden', 'true');
      $('#j-search-progress-bar').css('width', '0%');
    }
  }

  function stripLrcMeta(lrc) {
    if (!lrc) return lrc;
    var lines = lrc.split('\n').filter(function(line) {
      var text = line.replace(/\[[^\]]+\]/g, '').trim();
      if (!text) return false;
      return !/作\s*词|作\s*曲|编\s*曲|制作人|监制|统筹|出品|发行/i.test(text);
    });
    return lines.length ? lines.join('\n') : '[00:00.00] 暂无歌词';
  }

  function resolveMediaUrl(url) {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    return getUrl() + url.replace(/^\//, '');
  }

  function normalizeTrackMedia(track) {
    if (!track) return track;
    track.url = resolveMediaUrl(track.url);
    track.pic = resolveMediaUrl(track.pic);
    return track;
  }

  function buildDownloadUrl(url, name) {
    if (/api\.php\?/i.test(url)) {
      var sep = url.indexOf('?') >= 0 ? '&' : '?';
      return url + sep + 'dl=1&name=' + encodeURIComponent(name);
    }
    return (
      getUrl() +
      '?download=1&url=' +
      encodeURIComponent(url) +
      '&name=' +
      encodeURIComponent(name)
    );
  }

  function canNativeSave() {
    return !!(
      window.webkit &&
      window.webkit.messageHandlers &&
      window.webkit.messageHandlers.ryanSave
    );
  }

  function nativeSave(payload) {
    if (!canNativeSave()) return false;
    try {
      window.webkit.messageHandlers.ryanSave.postMessage(payload);
      return true;
    } catch (e) {
      return false;
    }
  }

  function bindNativeDownloadButtons() {
    if (!canNativeSave()) return;
    var $src = $('#j-src-btn');
    var $lrc = $('#j-lrc-btn');
    $src.off('click.ryanNative').on('click.ryanNative', function(e) {
      var href = $(this).attr('href') || '';
      var name = ($(this).data('save-name') || 'RyanMusic') + '';
      if (!href || href === '#') return;
      if (!/\.mp3$/i.test(name) && !/\.m4a$/i.test(name)) {
        name += '.mp3';
      }
      if (nativeSave({ url: href, filename: name })) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
    $lrc.off('click.ryanNative').on('click.ryanNative', function(e) {
      var text = $('#j-lrc').text() || '';
      var name = ($(this).data('save-name') || 'RyanMusic') + '';
      if (!/\.lrc$/i.test(name)) {
        name += '.lrc';
      }
      if (nativeSave({ text: text, filename: name })) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

  function forceLrcLineHeight(playerInstance) {
    if (!playerInstance || !playerInstance.lrcContents) return;
    var ps = playerInstance.lrcContents.getElementsByTagName('p');
    for (var i = 0; i < ps.length; i++) {
      ps[i].style.height = LRC_LINE_HEIGHT + 'px';
      ps[i].style.minHeight = LRC_LINE_HEIGHT + 'px';
      ps[i].style.maxHeight = LRC_LINE_HEIGHT + 'px';
      ps[i].style.lineHeight = LRC_LINE_HEIGHT + 'px';
      ps[i].style.margin = '0';
      ps[i].style.overflow = 'hidden';
    }
  }

  function applyLrcTransform(playerInstance, immediate) {
    if (!playerInstance || !playerInstance.lrcContents) return;
    forceLrcLineHeight(playerInstance);
    var idx =
      typeof playerInstance.lrcIndex === 'number' ? playerInstance.lrcIndex : 0;
    var y = -idx * LRC_LINE_HEIGHT + LRC_CENTER_OFFSET;
    var contents = playerInstance.lrcContents;
    var noAnim = immediate || playerInstance._lrcDragging;
    if (noAnim) {
      contents.style.transition = 'none';
      contents.style.webkitTransition = 'none';
    } else {
      contents.style.transition = LRC_SCROLL_TRANSITION;
      contents.style.webkitTransition = LRC_SCROLL_TRANSITION;
    }
    contents.style.transform = 'translate3d(0,' + y + 'px,0)';
    contents.style.webkitTransform = 'translate3d(0,' + y + 'px,0)';
  }

  function syncLrcDisplay(playerInstance, time) {
    if (!playerInstance || typeof playerInstance.updateLrc !== 'function') return;
    if (typeof time === 'number' && !isNaN(time)) {
      playerInstance.updateLrc(time);
    } else {
      playerInstance.updateLrc();
    }
  }

  function getPlayerRoot() {
    var $el = $('#j-player');
    return $el.hasClass('aplayer') ? $el : $el.children('.aplayer').first();
  }

  function movePlayButton() {
    var $controller = getPlayerRoot().find('.aplayer-controller');
    var $btn = getPlayerRoot().find('.aplayer-pic .aplayer-button').first();
    if (!$btn.length) {
      $btn = getPlayerRoot().find('.aplayer-button').first();
    }
    if (!$btn.length || !$controller.length) return;
    if ($btn.parent()[0] !== $controller[0]) {
      $controller.prepend($btn);
    }
    $btn.addClass('studio-play-btn');
  }

  function resetPlayerListLayout($ap) {
    var $list = $ap.find('.aplayer-list');
    if (!$list.length) return;
    $list.removeClass('aplayer-list-hide');
    $list.css({
      height: 'auto',
      maxHeight: 'none',
      overflow: 'visible'
    });
  }

  function cleanPlayerAuthorLabel($ap) {
    $ap.find('.aplayer-author').each(function() {
      var text = $.trim($(this).text());
      if (/^-\s*/.test(text)) {
        $(this).text(text.replace(/^-\s*/, ''));
      }
    });
  }

  function tunePlayerStudio(playerInstance) {
    var $ap = getPlayerRoot();
    if (!$ap.length) return;

    movePlayButton();
    resetPlayerListLayout($ap);

    var lrcHeight = LRC_LINE_HEIGHT * LRC_VISIBLE_LINES;
    var $lrc = $ap.find('.aplayer-lrc');

    $lrc.css({
      height: lrcHeight + 'px',
      maxHeight: lrcHeight + 'px',
      overflow: 'hidden'
    });

    $lrc.find('p').each(function() {
      this.style.height = LRC_LINE_HEIGHT + 'px';
      this.style.minHeight = LRC_LINE_HEIGHT + 'px';
      this.style.maxHeight = LRC_LINE_HEIGHT + 'px';
      this.style.lineHeight = LRC_LINE_HEIGHT + 'px';
      this.style.margin = '0';
      this.style.padding = '0 8px';
      this.style.textAlign = 'center';
      this.style.background = 'transparent';
      this.style.backgroundColor = 'transparent';
      this.style.overflow = 'hidden';
    });

    $ap.find('.aplayer-lrc-current').css({
      background: 'transparent',
      backgroundColor: 'transparent'
    });

    syncLrcDisplay(playerInstance);
    cleanPlayerAuthorLabel($ap);
  }

  function patchLrcCenterScroll(playerInstance) {
    if (!playerInstance || playerInstance._lrcCenterPatched) return;

    playerInstance._lrcCenterPatched = true;
    var origUpdateLrc = playerInstance.updateLrc.bind(playerInstance);

    playerInstance.updateLrc = function(time) {
      origUpdateLrc(time);
      applyLrcTransform(this);
    };

    if (playerInstance.audio) {
      playerInstance.audio.addEventListener('seeking', function() {
        playerInstance._lrcDragging = true;
        syncLrcDisplay(playerInstance);
        applyLrcTransform(playerInstance, true);
      });
      playerInstance.audio.addEventListener('seeked', function() {
        playerInstance._lrcDragging = false;
        syncLrcDisplay(playerInstance);
      });
    }

    var $barWrap = $(playerInstance.element).find('.aplayer-bar-wrap');
    $barWrap.off('mousemove.lrcSeek mousedown.lrcSeek');
    $barWrap.on('mousedown.lrcSeek', function() {
      playerInstance._lrcDragging = true;
      $barWrap.data('dragging', true);
    });
    $barWrap.on('mousemove.lrcSeek', function() {
      if (!$barWrap.data('dragging')) return;
      var duration = playerInstance.audio.duration;
      if (!duration || isNaN(duration)) return;
      var played = playerInstance.element.getElementsByClassName('aplayer-played')[0];
      if (!played) return;
      var ratio = parseFloat(played.style.width) / 100;
      if (isNaN(ratio)) return;
      syncLrcDisplay(playerInstance, ratio * duration);
      applyLrcTransform(playerInstance, true);
    });

    if (!window._ryanLrcSeekBound) {
      window._ryanLrcSeekBound = true;
      $(document).on('mouseup.lrcSeek', function() {
        var $wrap = $('#j-player .aplayer-bar-wrap');
        if ($wrap.data('dragging')) {
          $wrap.data('dragging', false);
          if (player) {
            player._lrcDragging = false;
            syncLrcDisplay(player);
          }
        }
      });
    }
  }

  function syncPlayerPlayingState(playerInstance) {
    if (!playerInstance) return;
    var $root = $('#j-player');
    if (playerInstance.audio && !playerInstance.audio.paused) {
      $root.addClass('is-playing');
    } else {
      $root.removeClass('is-playing');
    }
  }

  function bindPlayerPlayback(playerInstance, getTrackData, setValue, siteTitle) {
    if (!playerInstance || playerInstance._playbackBound) return;
    playerInstance._playbackBound = true;

    playerInstance.on('play', function() {
      var data = getTrackData();
      if (!data) return;
      var img = new Image();
      img.src = data.pic;
      img.onerror = function() {
        $('.aplayer-pic').css('background-image', "url('" + nopic + "')");
      };
      if (ambientGlow && data.pic) {
        ambientGlow.setCover(data.pic);
      }
      document.title = '正在播放: ' + data.title + ' - ' + data.author;
      setValue(data);
    });

    playerInstance.on('ended', function() {
      document.title = siteTitle;
    });
  }

  function updateLoadMoreButton(hasMore, filter) {
    var $more = $('#j-load-more');
    if (filter !== 'name' || !hasMore) {
      $more.prop('hidden', true).addClass('is-hidden');
      return;
    }
    $more.prop('hidden', false).removeClass('is-hidden').text('加载更多');
  }

  function bindPlayerStudio(playerInstance) {
    if (!playerInstance) return;
    patchLrcCenterScroll(playerInstance);
    playerInstance.on('play', function() {
      syncPlayerPlayingState(playerInstance);
      setTimeout(movePlayButton, 50);
      tunePlayerStudio(playerInstance);
    });
    playerInstance.on('pause', function() {
      syncPlayerPlayingState(playerInstance);
      setTimeout(movePlayButton, 50);
    });
    playerInstance.on('ended', function() {
      syncPlayerPlayingState(playerInstance);
    });
    syncPlayerPlayingState(playerInstance);
    setTimeout(function() {
      tunePlayerStudio(playerInstance);
    }, 0);
    setTimeout(function() {
      tunePlayerStudio(playerInstance);
    }, 200);
  }

  function syncMusicTypeUI() {
    $('#j-type label.am-radio-inline').each(function() {
      var $label = $(this);
      var checked = $label.find('input[name="music_type"]').prop('checked');
      $label.toggleClass('am-active', !!checked);
    });
    updateTypeIndicator();
  }

  function ensureSwitchIndicator($container, className) {
    var $ind = $container.children('.' + className);
    if (!$ind.length) {
      $ind = $('<span class="' + className + '" aria-hidden="true"></span>');
      $container.prepend($ind);
    }
    return $ind;
  }

  function moveSwitchIndicator($container, $active, className) {
    if (!$container.length || !$active.length) return;
    var $ind = ensureSwitchIndicator($container, className);
    var left = $active.position().left;
    var width = $active.outerWidth();
    $ind.css({
      width: width,
      transform: 'translate3d(' + left + 'px, 0, 0)'
    });
  }

  function updateTabsIndicator() {
    moveSwitchIndicator($('#j-nav'), $('#j-nav li.am-active').first(), 'music-tabs__indicator');
  }

  function updateTypeIndicator() {
    var $wrap = $('#j-type');
    if (!$wrap.is(':visible')) return;
    moveSwitchIndicator($wrap, $wrap.find('label.am-active').first(), 'music-type__indicator');
  }

  function refreshSwitchIndicators() {
    updateTabsIndicator();
    updateTypeIndicator();
  }

  var switchResizeTimer;
  $(window).on('resize', function() {
    clearTimeout(switchResizeTimer);
    switchResizeTimer = setTimeout(refreshSwitchIndicators, 80);
  });

  setTimeout(refreshSwitchIndicators, 60);
  setTimeout(refreshSwitchIndicators, 320);

  function setMusicType(value) {
    var $target = $('input[name="music_type"][value="' + value + '"]');
    if (!$target.length) return;
    $('input[name="music_type"]').prop('checked', false);
    $target.prop('checked', true);
    syncMusicTypeUI();
  }

  $('#j-type').on('change', 'input[name="music_type"]', function() {
    $('input[name="music_type"]').not(this).prop('checked', false);
    this.checked = true;
    syncMusicTypeUI();
  });

  syncMusicTypeUI();

  // 如果参数存在 name/id 和 type
  if ((qName || qId) && qType) {
    setTimeout(function() {
      $('#j-input').val(qName || qId);
      setMusicType(qType);
      if (qName) {
        $('#j-nav [data-filter="name"]').trigger('click');
      }
      if (qId) {
        $('#j-nav [data-filter="id"]').trigger('click');
      }
      $('#j-validator').trigger('submit');
    }, 0);
  }

  // 如果参数存在 url
  if (qUrl) {
    setTimeout(function() {
      $('#j-type').hide();
      $('#j-input').val(qUrl);
      $('#j-nav [data-filter="url"]').trigger('click');
      $('#j-validator').trigger('submit');
    }, 0);
  }

  function resetSearchState() {
    $('#j-input')
      .val('')
      .attr('disabled', false)
      .data('filter', 'name')
      .attr({
        placeholder: searchTabHolder.name,
        pattern: searchTabHolder.pattern_name
      })
      .removeClass('am-field-valid am-field-error am-active')
      .closest('.am-form-group')
      .removeClass('am-form-success am-form-error')
      .find('.am-alert')
      .hide();

    $('#j-nav li[data-filter="name"]')
      .addClass('am-active')
      .siblings('li')
      .removeClass('am-active');

    $('#j-type').show();
    setMusicType('netease');
    updateLoadMoreButton(false, 'name');
    setTimeout(updateTypeIndicator, 240);

    $('#j-submit').button('reset');
    stopSearchProgress(false);

    if (player) {
      try {
        player.pause();
      } catch (e) {
        /* ignore */
      }
      player = null;
    }
    playerList = [];
    $('#j-player').empty().addClass('aplayer');

    pushState(siteTitle, getUrl());
    document.title = siteTitle;
  }

  function initLightFlowCycle() {
    var $flow = $('.light-flow');
    if (!$flow.length) return null;

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      $flow.find('.light-flow__orb').addClass('is-visible');
      return {
        setPlaying: function() {},
        setCover: function() {},
        bindPlayer: function() {}
      };
    }

    var $orbs = $flow.find('.light-flow__orb');
    var $beam = $flow.find('.light-flow__beam');
    var flowEl = $flow[0];
    var schemes = [
      {
        orbs: ['250,45,85', '88,86,214', '255,120,160'],
        beam: ['250,45,85', '136,132,255'],
        opacity: 0.55
      },
      {
        orbs: ['88,86,214', '48,209,88', '250,45,85'],
        beam: ['88,86,214', '48,209,88'],
        opacity: 0.48
      },
      {
        orbs: ['255,149,64', '250,45,85', '136,132,255'],
        beam: ['255,149,64', '250,45,85'],
        opacity: 0.5
      },
      {
        orbs: ['64,156,255', '88,86,214', '250,45,85'],
        beam: ['64,156,255', '136,132,255'],
        opacity: 0.52
      }
    ];
    var lastScheme = -1;
    var paletteTimer = null;
    var playing = false;
    var rafId = 0;
    var levels = { pulse: 0, bass: 0, mid: 0, treble: 0, energy: 0 };
    var audioGraph = null;
    var boundAudio = null;

    function rand(min, max) {
      return min + Math.random() * (max - min);
    }

    function orbGradient(rgb) {
      return (
        'radial-gradient(circle, rgba(' +
        rgb +
        ', 0.78) 0%, rgba(' +
        rgb +
        ', 0) 68%)'
      );
    }

    function parseRgb(str) {
      var p = String(str)
        .split(',')
        .map(function(n) {
          return parseInt(n, 10) || 0;
        });
      return { r: p[0], g: p[1], b: p[2] };
    }

    function applyPalette(scheme) {
      $orbs.each(function(i) {
        var $orb = $(this);
        var rgb = scheme.orbs[i % scheme.orbs.length];
        $orb.css({
          background: orbGradient(rgb),
          '--orb-opacity': (scheme.opacity * rand(0.88, 1.08)).toFixed(2),
          '--orb-base-scale': rand(0.92, 1.12).toFixed(2),
          left: rand(-12, 72) + '%',
          top: rand(-12, 72) + '%'
        });
        $orb.addClass('is-visible');
      });
      var beamA = scheme.beam[0].split(',');
      var beamB = scheme.beam[1].split(',');
      var c0 = parseRgb(scheme.orbs[0]);
      var c1 = parseRgb(scheme.orbs[1]);
      var c2 = parseRgb(scheme.orbs[2] || scheme.orbs[0]);
      $beam.css({
        '--beam-ar': beamA[0],
        '--beam-ag': beamA[1],
        '--beam-ab': beamA[2],
        '--beam-br': beamB[0],
        '--beam-bg': beamB[1],
        '--beam-bb': beamB[2],
        '--beam-duration': (playing ? rand(5.5, 9) : rand(7, 13)).toFixed(1) + 's',
        '--beam-opacity': rand(0.7, 0.95).toFixed(2)
      });
      $flow.css({
        '--bloom-r': c0.r,
        '--bloom-g': c0.g,
        '--bloom-b': c0.b,
        '--bloom2-r': c1.r,
        '--bloom2-g': c1.g,
        '--bloom2-b': c1.b,
        '--bloom3-r': c2.r,
        '--bloom3-g': c2.g,
        '--bloom3-b': c2.b
      });
    }

    function nextIdlePalette() {
      var idx;
      do {
        idx = Math.floor(Math.random() * schemes.length);
      } while (idx === lastScheme && schemes.length > 1);
      lastScheme = idx;
      applyPalette(schemes[idx]);
      paletteTimer = setTimeout(nextIdlePalette, playing ? rand(9000, 14000) : rand(5200, 8800));
    }

    function avgRange(data, from, to) {
      var sum = 0;
      var n = 0;
      for (var i = from; i < to && i < data.length; i++) {
        sum += data[i];
        n++;
      }
      return n ? sum / n / 255 : 0;
    }

    function smooth(curr, next, factor) {
      return curr + (next - curr) * factor;
    }

    function detachAudioGraph() {
      audioGraph = null;
      boundAudio = null;
    }

    function ensureAudioGraph(audio) {
      if (!audio) return null;
      if (audioGraph && boundAudio === audio) return audioGraph;
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      try {
        if (audio._ryanMediaConnected) {
          audioGraph = audio._ryanMediaConnected;
          boundAudio = audio;
          return audioGraph;
        }
        var ctx = new Ctx();
        var src = ctx.createMediaElementSource(audio);
        var analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.72;
        src.connect(analyser);
        analyser.connect(ctx.destination);
        audioGraph = {
          ctx: ctx,
          analyser: analyser,
          data: new Uint8Array(analyser.frequencyBinCount)
        };
        audio._ryanMediaConnected = audioGraph;
        boundAudio = audio;
        return audioGraph;
      } catch (e) {
        detachAudioGraph();
        return null;
      }
    }

    function readLevels(audio) {
      var graph = ensureAudioGraph(audio);
      if (graph && graph.ctx.state === 'suspended') {
        graph.ctx.resume().catch(function() {});
      }
      if (graph) {
        graph.analyser.getByteFrequencyData(graph.data);
        var bass = avgRange(graph.data, 0, 6);
        var mid = avgRange(graph.data, 6, 24);
        var treble = avgRange(graph.data, 24, 64);
        var energy = avgRange(graph.data, 0, graph.data.length);
        var pulse = Math.min(1, bass * 1.35 + energy * 0.35);
        return { pulse: pulse, bass: bass, mid: mid, treble: treble, energy: energy };
      }
      // 无频谱时用有机律动兜底，避免背景完全静止
      var t = performance.now() / 1000;
      var organicBass = 0.35 + 0.35 * Math.sin(t * 2.2) + 0.15 * Math.sin(t * 4.1);
      var organicMid = 0.3 + 0.3 * Math.sin(t * 3.4 + 1.2);
      var organicTreble = 0.22 + 0.28 * Math.sin(t * 5.6 + 0.4);
      var energy = (organicBass + organicMid + organicTreble) / 3;
      return {
        pulse: Math.max(0, Math.min(1, organicBass)),
        bass: Math.max(0, Math.min(1, organicBass)),
        mid: Math.max(0, Math.min(1, organicMid)),
        treble: Math.max(0, Math.min(1, organicTreble)),
        energy: Math.max(0, Math.min(1, energy))
      };
    }

    function writeCssLevels() {
      flowEl.style.setProperty('--pulse', levels.pulse.toFixed(3));
      flowEl.style.setProperty('--bass', levels.bass.toFixed(3));
      flowEl.style.setProperty('--mid', levels.mid.toFixed(3));
      flowEl.style.setProperty('--treble', levels.treble.toFixed(3));
      flowEl.style.setProperty('--energy', levels.energy.toFixed(3));
    }

    function tickReactive(audio) {
      if (!playing) return;
      var next = readLevels(audio);
      levels.pulse = smooth(levels.pulse, next.pulse, 0.28);
      levels.bass = smooth(levels.bass, next.bass, 0.24);
      levels.mid = smooth(levels.mid, next.mid, 0.22);
      levels.treble = smooth(levels.treble, next.treble, 0.2);
      levels.energy = smooth(levels.energy, next.energy, 0.2);
      writeCssLevels();
      rafId = requestAnimationFrame(function() {
        tickReactive(audio);
      });
    }

    function settleDown() {
      cancelAnimationFrame(rafId);
      rafId = 0;
      var step = function() {
        levels.pulse = smooth(levels.pulse, 0, 0.08);
        levels.bass = smooth(levels.bass, 0, 0.08);
        levels.mid = smooth(levels.mid, 0, 0.08);
        levels.treble = smooth(levels.treble, 0, 0.08);
        levels.energy = smooth(levels.energy, 0, 0.08);
        writeCssLevels();
        if (levels.energy > 0.01) {
          rafId = requestAnimationFrame(step);
        }
      };
      rafId = requestAnimationFrame(step);
    }

    function setPlaying(isPlaying, audio) {
      playing = !!isPlaying;
      $flow.toggleClass('light-flow--playing', playing);
      cancelAnimationFrame(rafId);
      rafId = 0;
      if (playing) {
        tickReactive(audio || null);
      } else {
        settleDown();
      }
    }

    function rgbToStr(c) {
      return [c.r, c.g, c.b].join(',');
    }

    function sampleCoverPalette(picUrl, done) {
      if (!picUrl || /nopic\.jpg/i.test(picUrl)) {
        done(null);
        return;
      }
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function() {
        try {
          var canvas = document.createElement('canvas');
          var size = 32;
          canvas.width = size;
          canvas.height = size;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, size, size);
          var data = ctx.getImageData(0, 0, size, size).data;
          var buckets = {};
          for (var i = 0; i < data.length; i += 16) {
            var r = data[i];
            var g = data[i + 1];
            var b = data[i + 2];
            var a = data[i + 3];
            if (a < 200) continue;
            var max = Math.max(r, g, b);
            var min = Math.min(r, g, b);
            if (max < 40 || min > 220) continue;
            if (max - min < 18) continue;
            var key =
              (r >> 4) + ',' + (g >> 4) + ',' + (b >> 4);
            if (!buckets[key]) buckets[key] = { r: 0, g: 0, b: 0, n: 0 };
            buckets[key].r += r;
            buckets[key].g += g;
            buckets[key].b += b;
            buckets[key].n += 1;
          }
          var colors = Object.keys(buckets)
            .map(function(k) {
              var x = buckets[k];
              return {
                r: Math.round(x.r / x.n),
                g: Math.round(x.g / x.n),
                b: Math.round(x.b / x.n),
                n: x.n
              };
            })
            .sort(function(a, b) {
              return b.n - a.n;
            });
          if (colors.length < 2) {
            done(null);
            return;
          }
          done({
            orbs: [
              rgbToStr(colors[0]),
              rgbToStr(colors[1]),
              rgbToStr(colors[2] || colors[0])
            ],
            beam: [rgbToStr(colors[0]), rgbToStr(colors[1])],
            opacity: 0.62
          });
        } catch (e) {
          done(null);
        }
      };
      img.onerror = function() {
        done(null);
      };
      img.src = picUrl;
    }

    function setCover(picUrl) {
      sampleCoverPalette(picUrl, function(palette) {
        if (!palette) return;
        if (paletteTimer) clearTimeout(paletteTimer);
        applyPalette(palette);
        paletteTimer = setTimeout(nextIdlePalette, playing ? 12000 : 8000);
      });
    }

    function bindPlayer(playerInstance, getTrackData) {
      if (!playerInstance || playerInstance._ambientBound) return;
      playerInstance._ambientBound = true;
      playerInstance.on('play', function() {
        var track = getTrackData ? getTrackData() : null;
        if (track && track.pic) setCover(track.pic);
        setPlaying(true, playerInstance.audio);
      });
      playerInstance.on('pause', function() {
        setPlaying(false);
      });
      playerInstance.on('ended', function() {
        setPlaying(false);
      });
    }

    nextIdlePalette();
    writeCssLevels();

    $(window).on('beforeunload', function() {
      if (paletteTimer) clearTimeout(paletteTimer);
      cancelAnimationFrame(rafId);
    });

    return {
      setPlaying: setPlaying,
      setCover: setCover,
      bindPlayer: bindPlayer
    };
  }

  var ambientGlow = initLightFlowCycle();

  // Tab 切换
  $('#j-nav').on('click', 'li', function() {
    var filter = $(this).data('filter');

    $(this)
      .addClass('am-active')
      .siblings('li')
      .removeClass('am-active');

    $('#j-input')
      .data('filter', filter)
      .attr({
        placeholder: searchTabHolder[filter],
        pattern: searchTabHolder['pattern_' + filter]
      })
      .removeClass('am-field-valid am-field-error am-active')
      .closest('.am-form-group')
      .removeClass('am-form-success am-form-error')
      .find('.am-alert')
      .hide();

    if (filter === 'url') {
      $('#j-type').slideUp(220);
    } else {
      $('#j-type').slideDown(220, updateTypeIndicator);
    }
    updateTabsIndicator();
  });

  // 输入验证
  $('#j-validator').validator({
    onValid: function onValid(v) {
      $(v.field)
        .closest('.am-form-group')
        .find('.am-alert')
        .hide();
    },
    onInValid: function onInValid(v) {
      var $field = $(v.field);
      var $group = $field.closest('.am-form-group');
      var msgs = {
        name: '将 名称 和 作者 一起输入可提高匹配度',
        id: '输入错误，请查看下面的帮助',
        url: '输入错误，请查看下面的帮助'
      };
      var $alert = $group.find('.am-alert');
      var msg = msgs[$field.data('filter')] || this.getValidationMessage(v);

      if (!$alert.length) {
        $alert = $(
          '<div class="am-alert am-alert-danger am-animation-shake"></div>'
        )
          .hide()
          .appendTo($group);
      }
      $alert.html(msg).show();
    },
    submit: function submit(v) {
      v.preventDefault();
      if (this.isFormValid()) {
        var input = $.trim($('#j-input').val());
        var filter = $('#j-input').data('filter');
        var type =
          filter === 'url' ? '_' : $('input[name="music_type"]:checked').val();
        var page = 1;
        var isload = false;
        var $more = $('#j-load-more');
        var ajax = function ajax(input, filter, type, page) {
          $.ajax({
            type: 'POST',
            url: getUrl(),
            timeout: 30000,
            data: {
              input: input,
              filter: filter,
              type: type,
              page: page
            },
            dataType: 'json',
            beforeSend: function beforeSend() {
              isload = true;
              searchProgressOk = false;
              var title = document.title;
              switch (filter) {
                case 'name':
                  pushState(title, getUrl('?name=' + input + '&type=' + type));
                  break;
                case 'id':
                  pushState(title, getUrl('?id=' + input + '&type=' + type));
                  break;
                case 'url':
                  pushState(title, getUrl('?url=' + encodeURIComponent(input)));
                  break;
              }
              if (page === 1) {
                $('#j-input').attr('disabled', true);
                $('#j-submit').button('loading');
                updateLoadMoreButton(false, filter);
                startSearchProgress();
              } else {
                $more.text('请稍后...');
              }
            },
            success: function success(result) {
              if (result.code === 200 && result.data) {
                if (page === 1) {
                  searchProgressOk = true;
                }
                result.data.map(function(v) {
                  if (!v.title) v.title = '暂无';
                  if (!v.author) v.author = '暂无';
                  if (!v.pic) v.pic = nopic;
                  if (!v.lrc) v.lrc = '[00:00.00] 暂无歌词';
                  if (!/\[\d{1,2}:\d{2}/.test(v.lrc)) {
                    v.lrc = '[00:00.00] 暂无歌词';
                  }
                  v.lrc = stripLrcMeta(v.lrc);
                  normalizeTrackMedia(v);
                });
                var setValue = function setValue(data) {
                  var name = data.title + '-' + data.author;
                  $('#j-src').val(data.url);
                  $('#j-src-btn')
                    .attr('href', buildDownloadUrl(data.url, name))
                    .attr('data-save-name', name)
                    .removeAttr('target download');
                  $('#j-lrc').text(data.lrc);
                  $('#j-lrc-btn').attr(
                    'href',
                    'data:application/octet-stream;base64,' +
                      btoa(unescape(encodeURIComponent(data.lrc)))
                  );
                  $('#j-lrc-btn').attr('download', name + '.lrc');
                  $('#j-lrc-btn').attr('data-save-name', name);
                  $('#j-src-btn-icon')
                    .addClass('am-icon-download')
                    .removeClass('am-icon-external-link');
                  $('#j-lrc-btn-icon')
                    .addClass('am-icon-download')
                    .removeClass('am-icon-external-link');
                  bindNativeDownloadButtons();
                };

                if (page === 1) {
                  if (player) {
                    player.pause();
                  }

                  playerList = result.data;

                  setValue(playerList[0]);

                  $('#j-validator').slideUp();

                  player = new APlayer({
                    element: $('#j-player')[0],
                    autoplay: false,
                    narrow: false,
                    showlrc: 1,
                    mutex: false,
                    mode: 'circulation',
                    preload: 'metadata',
                    theme: '#fa2d55',
                    music: result.data
                  });

                  bindPlayerStudio(player);
                  bindPlayerPlayback(
                    player,
                    function() {
                      return playerList[player.playIndex];
                    },
                    setValue,
                    siteTitle
                  );
                  if (ambientGlow) {
                    ambientGlow.bindPlayer(player, function() {
                      return playerList[player.playIndex];
                    });
                    if (playerList[0] && playerList[0].pic) {
                      ambientGlow.setCover(playerList[0].pic);
                    }
                  }
                  movePlayButton();
                  tunePlayerStudio(player);

                  $('#j-main').slideDown(320);

                  $more.off('click.loadMore').on('click.loadMore', function() {
                    if (isload) return;
                    page++;
                    ajax(input, filter, type, page);
                  });
                } else {
                  player.addMusic(result.data);
                  playerList = playerList.concat(result.data);
                  resetPlayerListLayout(getPlayerRoot());
                  movePlayButton();
                }

                var hasMore =
                  filter === 'name' &&
                  (typeof result.has_more === 'boolean'
                    ? result.has_more
                    : result.data.length >= 10);
                updateLoadMoreButton(hasMore, filter);
              } else {
                if (page === 1) {
                  $('#j-input')
                    .closest('.am-form-group')
                    .find('.am-alert')
                    .html(result.error || '(°ー°〃) 服务器好像罢工了')
                    .show();
                } else {
                  $more.text('没有了');
                  setTimeout(function() {
                    updateLoadMoreButton(false, filter);
                  }, 1000);
                }
              }
            },
            error: function error(e, t) {
              if (page === 1) {
                var err = '(°ー°〃) 出了点小问题，请重试';
                if (t === 'timeout') {
                  err = '(°ー°〃) 请求超时了，请稍后重试';
                }
                $('#j-input')
                  .closest('.am-form-group')
                  .find('.am-alert')
                  .html(err)
                  .show();
              } else {
                $more.text('(°ー°〃) 加载失败了，点击重试');
              }
            },
            complete: function complete() {
              isload = false;
              if (page === 1) {
                stopSearchProgress(searchProgressOk);
                $('#j-input').attr('disabled', false);
                $('#j-submit').button('reset');
              }
            }
          });
        };

        ajax(input, filter, type, page);
      }
    }
  });

  $('#j-main input, #j-main textarea').on('focus', function() {
    $(this).select();
  });

  $('#j-back').on('click', function() {
    var $btn = $(this);
    if ($btn.hasClass('is-loading')) return;
    $btn.addClass('is-loading');
    $('#j-validator').slideDown(320);
    $('#j-main').slideUp(320, function() {
      $('#j-main input, #j-main textarea').val('');
      resetSearchState();
      $btn.removeClass('is-loading');
    });
  });
});
