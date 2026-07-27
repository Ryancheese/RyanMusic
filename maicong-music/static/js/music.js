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
    if (!$flow.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      $flow.find('.light-flow__orb').addClass('is-visible');
      return;
    }

    var $orbs = $flow.find('.light-flow__orb');
    var $beam = $flow.find('.light-flow__beam');
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
    var timer = null;

    function rand(min, max) {
      return min + Math.random() * (max - min);
    }

    function orbGradient(rgb) {
      return (
        'radial-gradient(circle, rgba(' +
        rgb +
        ', 0.72) 0%, rgba(' +
        rgb +
        ', 0) 68%)'
      );
    }

    function placeOrb($orb, alpha) {
      $orb.css({
        left: rand(-12, 72) + '%',
        top: rand(-12, 72) + '%',
        transform: 'scale(' + rand(0.88, 1.18).toFixed(2) + ')',
        '--orb-opacity': alpha.toFixed(2)
      });
    }

    function tick() {
      var idx;
      do {
        idx = Math.floor(Math.random() * schemes.length);
      } while (idx === lastScheme && schemes.length > 1);
      lastScheme = idx;

      var scheme = schemes[idx];
      $orbs.each(function(i) {
        var $orb = $(this);
        $orb.removeClass('is-visible');
        placeOrb($orb, scheme.opacity * rand(0.85, 1.1));
        $orb.css('background', orbGradient(scheme.orbs[i % scheme.orbs.length]));
        setTimeout(function() {
          $orb.addClass('is-visible');
        }, 80 + i * 120);
      });

      var beamA = scheme.beam[0].split(',');
      var beamB = scheme.beam[1].split(',');
      $beam.css({
        '--beam-ar': beamA[0],
        '--beam-ag': beamA[1],
        '--beam-ab': beamA[2],
        '--beam-br': beamB[0],
        '--beam-bg': beamB[1],
        '--beam-bb': beamB[2],
        '--beam-duration': rand(7, 13).toFixed(1) + 's',
        '--beam-opacity': rand(0.65, 0.95).toFixed(2)
      });

      timer = setTimeout(tick, rand(5200, 8800));
    }

    tick();

    $(window).on('beforeunload', function() {
      if (timer) clearTimeout(timer);
    });
  }

  initLightFlowCycle();

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
