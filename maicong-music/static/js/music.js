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
        // 清掉 APlayer 写死的 height，交给 CSS max-height + 滚动
        list.style.height = '';
        list.style.maxHeight = '';
        list.style.overflow = '';
        list.style.overflowX = 'hidden';
        list.style.overflowY = 'auto';
        void list.offsetHeight;
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
  var CHANNEL_LABELS = {
    netease: '网易云',
    qq: 'QQ 音乐'
  };
  var LIB = {
    likedKey: 'ryanmusic-liked-v1',
    recentKey: 'ryanmusic-recent-v1',
    playlistKey: 'ryanmusic-playlist-v1',
    recentMax: 80,
    playlistMax: 200,
    channel: 'all',
    tab: 'liked'
  };

  function channelLabel(type) {
    return CHANNEL_LABELS[type] || type || '未知';
  }

  function libTrackKey(track) {
    if (!track || !track.type || track.songid == null || track.songid === '') {
      return '';
    }
    return String(track.type) + ':' + String(track.songid);
  }

  function readLibList(storageKey) {
    try {
      var raw = localStorage.getItem(storageKey);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function writeLibList(storageKey, list) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(list));
    } catch (e) {
      // quota / private mode
    }
  }

  function libCoverUrl(item) {
    if (!item || !item.type || item.songid == null || item.songid === '') {
      return nopic;
    }
    return (
      getUrl() +
      '?cover=1&type=' +
      encodeURIComponent(item.type) +
      '&id=' +
      encodeURIComponent(String(item.songid))
    );
  }

  function toLibItem(track) {
    return {
      type: track.type,
      songid: String(track.songid),
      title: track.title || '暂无',
      author: track.author || '暂无',
      pic: '',
      link: track.link || '',
      savedAt: Date.now()
    };
  }

  function isLiked(track) {
    var key = libTrackKey(track);
    if (!key) return false;
    return readLibList(LIB.likedKey).some(function(item) {
      return libTrackKey(item) === key;
    });
  }

  function toggleLike(track) {
    var key = libTrackKey(track);
    if (!key) return false;
    var list = readLibList(LIB.likedKey);
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (libTrackKey(list[i]) === key) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) {
      list.splice(idx, 1);
      writeLibList(LIB.likedKey, list);
      return false;
    }
    list.unshift(toLibItem(track));
    writeLibList(LIB.likedKey, list);
    return true;
  }

  function removeLiked(track) {
    var key = libTrackKey(track);
    if (!key) return;
    writeLibList(
      LIB.likedKey,
      readLibList(LIB.likedKey).filter(function(item) {
        return libTrackKey(item) !== key;
      })
    );
  }

  function isInPlaylist(track) {
    var key = libTrackKey(track);
    if (!key) return false;
    if (playerList.length) {
      return playerList.some(function(item) {
        return libTrackKey(item) === key;
      });
    }
    return readLibList(LIB.playlistKey).some(function(item) {
      return libTrackKey(item) === key;
    });
  }

  function persistPlaylistFromPlayer() {
    if (!playerList.length) {
      writeLibList(LIB.playlistKey, []);
      return;
    }
    writeLibList(
      LIB.playlistKey,
      playerList
        .map(toLibItem)
        .filter(function(item) {
          return !!libTrackKey(item);
        })
        .slice(-LIB.playlistMax)
    );
  }

  function addToPlaylist(track) {
    var key = libTrackKey(track);
    if (!key) return false;
    var list = readLibList(LIB.playlistKey);
    if (list.some(function(item) { return libTrackKey(item) === key; })) {
      return false;
    }
    list.push(toLibItem(track));
    if (list.length > LIB.playlistMax) {
      list = list.slice(list.length - LIB.playlistMax);
    }
    writeLibList(LIB.playlistKey, list);
    return true;
  }

  function removeFromPlaylist(track) {
    var key = libTrackKey(track);
    if (!key) return;
    writeLibList(
      LIB.playlistKey,
      readLibList(LIB.playlistKey).filter(function(item) {
        return libTrackKey(item) !== key;
      })
    );
    removeTrackFromPlayer(key);
  }

  function clearPlaylist() {
    writeLibList(LIB.playlistKey, []);
    if (player) {
      try {
        player.pause();
      } catch (e) {}
    }
    player = null;
    playerList = [];
    $('#j-player').empty();
    syncLikeButton(null);
  }

  function removeTrackFromPlayer(key) {
    if (!key || !playerList.length) return;
    var playIndex = player ? player.playIndex || 0 : 0;
    var removingCurrent = libTrackKey(playerList[playIndex]) === key;
    var next = playerList.filter(function(item) {
      return libTrackKey(item) !== key;
    });
    if (!next.length) {
      if (player) {
        try {
          player.pause();
        } catch (e) {}
      }
      player = null;
      playerList = [];
      $('#j-player').empty();
      persistPlaylistFromPlayer();
      syncLikeButton(null);
      return;
    }
    if (!player) {
      playerList = next;
      persistPlaylistFromPlayer();
      return;
    }
    var newIndex = playIndex;
    if (removingCurrent) {
      newIndex = Math.min(playIndex, next.length - 1);
    } else {
      var removedBefore = 0;
      for (var i = 0; i < playIndex; i++) {
        if (libTrackKey(playerList[i]) === key) removedBefore += 1;
      }
      newIndex = Math.max(0, playIndex - removedBefore);
    }
    openPlayerWithTracks(next, newIndex, next[newIndex] && next[newIndex].type);
  }

  function enqueueToPlayer(trackOrItem, done) {
    var key = libTrackKey(trackOrItem);
    if (!key) {
      if (done) done(false);
      return;
    }
    if (playerList.some(function(item) { return libTrackKey(item) === key; })) {
      persistPlaylistFromPlayer();
      if (done) done(false);
      return;
    }
    if (!player) {
      var added = addToPlaylist(trackOrItem);
      if (done) done(added);
      return;
    }

    var applyTrack = function(track) {
      if (!track || !player) {
        addToPlaylist(trackOrItem);
        if (done) done(!!track);
        return;
      }
      if (playerList.some(function(item) { return libTrackKey(item) === libTrackKey(track); })) {
        persistPlaylistFromPlayer();
        if (done) done(false);
        return;
      }
      try {
        player.addMusic([track]);
      } catch (e) {
        addToPlaylist(track);
        if (done) done(false);
        return;
      }
      playerList.push(track);
      persistPlaylistFromPlayer();
      resetPlayerListLayout(getPlayerRoot());
      movePlayButton();
      tunePlayerStudio(player);
      if (done) done(true);
    };

    if (trackOrItem.url) {
      applyTrack(trackOrItem);
      return;
    }
    fetchLibTrack(trackOrItem).done(applyTrack);
  }

  function librarySourceForTab(tab) {
    if (tab === 'recent') return readLibList(LIB.recentKey);
    if (tab === 'playlist') {
      return playerList.length
        ? playerList.map(toLibItem)
        : readLibList(LIB.playlistKey);
    }
    return readLibList(LIB.likedKey);
  }

  function indexOfLibItem(items, item) {
    var key = libTrackKey(item);
    var found = 0;
    if (!key) return 0;
    items.forEach(function(row, i) {
      if (libTrackKey(row) === key) found = i;
    });
    return found;
  }

  /** 从列表某首起播到结尾，整表替换播放列表（不含该首之前，也不混入中途手动加入的歌） */
  function playFromListContext(tab, item) {
    var items = filterLibByChannel(librarySourceForTab(tab), LIB.channel);
    if (!items.length) return;
    var idx = indexOfLibItem(items, item);
    var queue = items.slice(idx);
    if (!queue.length) return;
    playLibraryItems(queue, 0);
  }

  function addRecent(track) {
    var key = libTrackKey(track);
    if (!key) return;
    var list = readLibList(LIB.recentKey).filter(function(item) {
      return libTrackKey(item) !== key;
    });
    list.unshift(toLibItem(track));
    if (list.length > LIB.recentMax) {
      list = list.slice(0, LIB.recentMax);
    }
    writeLibList(LIB.recentKey, list);
  }

  function filterLibByChannel(list, channel) {
    if (!channel || channel === 'all') return list;
    return list.filter(function(item) {
      return item.type === channel;
    });
  }

  function syncLikeButton(track) {
    var $btn = $('#j-like-btn');
    var $add = $('#j-add-playlist-btn');
    var $channel = $('#j-track-channel');
    if (!$btn.length) return;
    if (!track || !libTrackKey(track)) {
      $btn.prop('disabled', true).removeClass('is-liked').attr('aria-pressed', 'false');
      $btn.find('.like-btn__icon').text('♡');
      $btn.find('.like-btn__text').text('喜欢');
      if ($add.length) {
        $add.prop('disabled', true).removeClass('is-added');
        $add.find('.like-btn__text').text('加入播放列表');
      }
      $channel.prop('hidden', true).text('');
      return;
    }
    var liked = isLiked(track);
    var inPl = isInPlaylist(track);
    $btn.prop('disabled', false);
    $btn.toggleClass('is-liked', liked).attr('aria-pressed', liked ? 'true' : 'false');
    $btn.find('.like-btn__icon').text(liked ? '♥' : '♡');
    $btn.find('.like-btn__text').text(liked ? '已喜欢' : '喜欢');
    if ($add.length) {
      $add.prop('disabled', false);
      $add.toggleClass('is-added', inPl);
      $add.find('.like-btn__text').text(inPl ? '已在播放列表' : '加入播放列表');
    }
    $channel
      .prop('hidden', false)
      .removeClass('is-netease is-qq')
      .addClass(track.type === 'qq' ? 'is-qq' : 'is-netease')
      .text(channelLabel(track.type));
  }

  function renderLibrary() {
    var $list = $('#j-library-list');
    var $empty = $('#j-library-empty');
    if (!$list.length) return;

    var source;
    if (LIB.tab === 'recent') {
      source = readLibList(LIB.recentKey);
    } else if (LIB.tab === 'playlist') {
      // 播放中以播放器队列为准，与下方列表保持一致
      source = playerList.length
        ? playerList.map(toLibItem)
        : readLibList(LIB.playlistKey);
    } else {
      source = readLibList(LIB.likedKey);
    }
    var items = filterLibByChannel(source, LIB.channel);
    $list.empty();

    if (!items.length) {
      $empty.show().text(
        LIB.tab === 'recent'
          ? '还没有最近播放。'
          : LIB.tab === 'playlist'
            ? '播放列表还是空的。从喜欢/最近点歌即可生成。'
            : '还没有喜欢的歌。播放后点红心即可收藏。'
      );
      return;
    }
    $empty.hide();
    items.forEach(function(item, index) {
      var badgeClass =
        item.type === 'qq'
          ? 'local-library__badge local-library__badge--qq'
          : 'local-library__badge local-library__badge--netease';
      var liked = isLiked(item);
      var actionHtml;
      if (LIB.tab === 'playlist') {
        actionHtml =
          '<button type="button" class="local-library__action" data-act="remove-pl" title="移出播放列表">✕</button>';
      } else if (liked) {
        actionHtml =
          '<button type="button" class="local-library__action local-library__action--liked" data-act="unlike" title="取消喜欢">♥</button>' +
          '<button type="button" class="local-library__action" data-act="add-pl" title="加入播放列表">＋</button>';
      } else {
        actionHtml =
          '<button type="button" class="local-library__action" data-act="like" title="喜欢">♡</button>' +
          '<button type="button" class="local-library__action" data-act="add-pl" title="加入播放列表">＋</button>';
      }
      var $li = $(
        '<li class="local-library__item local-library__item--text">' +
          '<span class="local-library__index"></span>' +
          '<div class="local-library__meta">' +
          '<p class="local-library__name"></p>' +
          '<p class="local-library__sub"></p>' +
          '</div>' +
          '<div class="local-library__actions">' +
          actionHtml +
          '</div>' +
          '</li>'
      );
      $li.find('.local-library__index').text(index + 1);
      $li.find('.local-library__name').text(item.title || '暂无');
      $li
        .find('.local-library__sub')
        .html(
          '<span class="' +
            badgeClass +
            '">' +
            channelLabel(item.type) +
            '</span>' +
            (item.author || '')
        );
      $li.data('track', item);
      $list.append($li);
    });
  }

  var qName = q('name');
  var qId = q('id');
  var qUrl = q('url');
  var qType = q('type');
  var siteTitle = document.title;
  var searchTabHolder = {
    name: '搜索音乐，歌手',
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
    var el = $list[0];
    $list.removeClass('aplayer-list-hide');
    // 移除 APlayer 内联固定高度，避免追加歌曲后滚动区域不更新
    el.style.removeProperty('height');
    el.style.removeProperty('max-height');
    el.style.removeProperty('overflow');
    el.style.overflowX = 'hidden';
    el.style.overflowY = 'auto';
    void el.offsetHeight;
  }

  function refreshPlayerListAfterAppend(playerInstance, options) {
    options = options || {};
    var $ap = getPlayerRoot();
    if (!$ap.length) return;
    resetPlayerListLayout($ap);
    movePlayButton();
    if (playerInstance) {
      tunePlayerStudio(playerInstance);
    }

    var prevCount = typeof options.prevCount === 'number' ? options.prevCount : -1;
    var shouldScroll = options.scrollToNew === true;

    function scrollToNewItems() {
      resetPlayerListLayout($ap);
      var list = $ap.find('.aplayer-list')[0];
      if (!list) return;

      var $items = $ap.find('.aplayer-list ol li');
      var targetIndex = prevCount >= 0 ? Math.min(prevCount, Math.max(0, $items.length - 1)) : -1;
      var targetEl = targetIndex >= 0 ? $items.get(targetIndex) : null;

      if (targetEl && typeof targetEl.scrollIntoView === 'function') {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    if (!shouldScroll) {
      requestAnimationFrame(function() {
        resetPlayerListLayout($ap);
        maybeLoadMoreFromScroll();
      });
      return;
    }

    requestAnimationFrame(function() {
      requestAnimationFrame(scrollToNewItems);
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
    // 让播放器吃满结果区剩余高度，仅列表内部滚动
    $ap.css({
      height: '100%',
      maxHeight: '100%',
      minHeight: 0
    });
    if ($ap[0] && $ap[0].style) {
      $ap[0].style.removeProperty('height');
      $ap[0].style.height = '100%';
    }
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
      addRecent(data);
      syncLikeButton(data);
      renderLibrary();
    });

    playerInstance.on('ended', function() {
      document.title = siteTitle;
    });
  }

  var loadMoreState = {
    hasMore: false,
    loading: false,
    requestNext: null
  };

  function setLoadStatus(text) {
    var $status = $('#j-load-status');
    if (!$status.length) return;
    if (!text) {
      $status.prop('hidden', true).text('');
      return;
    }
    $status.prop('hidden', false).text(text);
  }

  function updateInfiniteLoadState(hasMore, filter) {
    loadMoreState.hasMore = filter === 'name' && !!hasMore;
    if (!loadMoreState.loading) {
      setLoadStatus('');
    }
  }

  function maybeLoadMoreFromScroll() {
    if (!loadMoreState.hasMore || loadMoreState.loading || typeof loadMoreState.requestNext !== 'function') {
      return;
    }
    var list = getPlayerRoot().find('.aplayer-list')[0];
    if (!list) return;
    if (list.scrollHeight <= list.clientHeight + 4) {
      loadMoreState.requestNext();
      return;
    }
    if (list.scrollTop + list.clientHeight >= list.scrollHeight - 56) {
      loadMoreState.requestNext();
    }
  }

  function bindPlaylistInfiniteScroll() {
    var list = getPlayerRoot().find('.aplayer-list')[0];
    if (!list) return;
    if (list._ryanInfiniteHandler) {
      list.removeEventListener('scroll', list._ryanInfiniteHandler);
    }
    list._ryanInfiniteHandler = function() {
      maybeLoadMoreFromScroll();
    };
    list.addEventListener('scroll', list._ryanInfiniteHandler, { passive: true });
  }

  function showResultMain(animated) {
    var $main = $('#j-main');
    // 始终用 flex，保证与顶部搜索同页铺满剩余高度
    if (animated && !$main.is(':visible')) {
      $main.stop(true, true).css('display', 'flex').hide().slideDown(280, function() {
        $main.css('display', 'flex');
        tunePlayerStudio(player);
        bindPlaylistInfiniteScroll();
      });
    } else {
      $main.stop(true, true).css('display', 'flex').show();
    }
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

  var SOURCE_META = {
    netease: {
      label: '网易',
      className: 'is-netease',
      title: '当前网易，点击切换到 QQ'
    },
    qq: {
      label: 'QQ',
      className: 'is-qq',
      title: '当前 QQ，点击切换到网易'
    }
  };

  function getMusicType() {
    return $('input[name="music_type"]:checked').val() || 'netease';
  }

  function syncMusicTypeUI() {
    var type = getMusicType();
    var meta = SOURCE_META[type] || SOURCE_META.netease;
    var $btn = $('#j-source-toggle');
    if (!$btn.length) return;
    $btn
      .removeClass('is-netease is-qq')
      .addClass(meta.className)
      .attr('title', meta.title)
      .attr('aria-label', '当前音源 ' + meta.label + '，点击切换');
    $btn.find('.source-toggle__text').text(meta.label);
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

  function updateTabsIndicator() {}

  function updateTypeIndicator() {}

  function refreshSwitchIndicators() {}

  function setMusicType(value) {
    if (value !== 'netease' && value !== 'qq') return;
    $('input[name="music_type"]').prop('checked', false);
    $('input[name="music_type"][value="' + value + '"]').prop('checked', true);
    syncMusicTypeUI();
  }

  $('#j-source-toggle').on('click', function(e) {
    e.preventDefault();
    setMusicType(getMusicType() === 'qq' ? 'netease' : 'qq');
  });

  syncMusicTypeUI();

  // 如果参数存在 name/id 和 type（统一按名称搜索入口展示，ID 仍可直达）
  if ((qName || qId) && qType) {
    setTimeout(function() {
      var filter = qName ? 'name' : 'id';
      $('#j-input')
        .val(qName || qId)
        .data('filter', filter)
        .attr({
          placeholder: searchTabHolder[filter],
          pattern: searchTabHolder['pattern_' + filter]
        });
      setMusicType(qType);
      $('#j-type').show();
      $('#j-validator').trigger('submit');
    }, 0);
  }

  // 如果参数存在 url
  if (qUrl) {
    setTimeout(function() {
      $('#j-type').hide();
      $('#j-input')
        .val(qUrl)
        .data('filter', 'url')
        .attr({
          placeholder: searchTabHolder.url,
          pattern: searchTabHolder.pattern_url
        });
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

    $('#j-type').show();
    setMusicType('netease');
    updateInfiniteLoadState(false, 'name');
    loadMoreState.requestNext = null;
    setLoadStatus('');
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

    var STORAGE_KEY = 'ryanmusic-ambient-reactive';
    var INTENSITY_KEY = 'ryanmusic-ambient-intensity';
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      $flow.find('.light-flow__orb').addClass('is-visible');
      return {
        setPlaying: function() {},
        setCover: function() {},
        bindPlayer: function() {},
        setReactiveEnabled: function() {},
        isReactiveEnabled: function() {
          return false;
        },
        setIntensity: function() {},
        getIntensity: function() {
          return 0.4;
        }
      };
    }

    var $orbs = $flow.find('.light-flow__orb');
    var $beam = $flow.find('.light-flow__beam');
    var flowEl = $flow[0];
    var schemes = [
      {
        orbs: ['250,45,85', '88,86,214', '255,120,160'],
        beam: ['250,45,85', '136,132,255'],
        opacity: 0.36
      },
      {
        orbs: ['88,86,214', '48,209,88', '250,45,85'],
        beam: ['88,86,214', '48,209,88'],
        opacity: 0.32
      },
      {
        orbs: ['255,149,64', '250,45,85', '136,132,255'],
        beam: ['255,149,64', '250,45,85'],
        opacity: 0.34
      },
      {
        orbs: ['64,156,255', '88,86,214', '250,45,85'],
        beam: ['64,156,255', '136,132,255'],
        opacity: 0.34
      }
    ];
    var lastScheme = -1;
    var paletteTimer = null;
    var playing = false;
    var lastAudio = null;
    var rafId = 0;
    var levels = { pulse: 0, bass: 0, mid: 0, treble: 0, energy: 0 };
    var audioGraph = null;
    var boundAudio = null;
    var reactiveEnabled = true;
    var intensity = 0.4;
    try {
      var savedIntensity = localStorage.getItem(INTENSITY_KEY);
      if (savedIntensity !== null) {
        var parsed = parseInt(savedIntensity, 10);
        if (!isNaN(parsed)) {
          intensity = Math.max(0, Math.min(1, parsed / 100));
        }
      }
      // 旧版开关：关掉时迁移为 0%
      var savedToggle = localStorage.getItem(STORAGE_KEY);
      if (savedToggle === '0' && intensity > 0) {
        intensity = 0;
        localStorage.setItem(INTENSITY_KEY, '0');
      }
    } catch (e) {
      /* ignore */
    }
    reactiveEnabled = intensity > 0;

    function rand(min, max) {
      return min + Math.random() * (max - min);
    }

    function orbGradient(rgb) {
      return (
        'radial-gradient(circle, rgba(' +
        rgb +
        ', 0.55) 0%, rgba(' +
        rgb +
        ', 0) 70%)'
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
          '--orb-opacity': (scheme.opacity * rand(0.9, 1.05)).toFixed(2),
          '--orb-base-scale': rand(0.95, 1.08).toFixed(2),
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
        '--beam-duration': (playing && reactiveEnabled ? rand(8, 12) : rand(11, 16)).toFixed(1) + 's',
        '--beam-opacity': rand(0.45, 0.65).toFixed(2)
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
      paletteTimer = setTimeout(nextIdlePalette, playing ? rand(12000, 18000) : rand(8000, 14000));
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

    function isSameOriginAudio(audio) {
      try {
        var src = audio.currentSrc || audio.src || '';
        if (!src) return false;
        var u = new URL(src, location.href);
        return u.origin === location.origin;
      } catch (e) {
        return false;
      }
    }

    function ensureAudioGraph(audio) {
      if (!audio) return null;
      // 跨域 CDN（api 302）接 MediaElementSource 会静音，只做同域代理流分析
      if (!isSameOriginAudio(audio)) return null;
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
        analyser.smoothingTimeConstant = 0.86;
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
        audioGraph = null;
        boundAudio = null;
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
        var bass = avgRange(graph.data, 0, 6) * 0.55;
        var mid = avgRange(graph.data, 6, 24) * 0.5;
        var treble = avgRange(graph.data, 24, 64) * 0.45;
        var energy = avgRange(graph.data, 0, graph.data.length) * 0.5;
        var pulse = Math.min(0.7, bass * 0.9 + energy * 0.25);
        return { pulse: pulse, bass: bass, mid: mid, treble: treble, energy: energy };
      }
      var t = performance.now() / 1000;
      var organicBass = 0.18 + 0.12 * Math.sin(t * 1.4) + 0.06 * Math.sin(t * 2.6);
      var organicMid = 0.14 + 0.1 * Math.sin(t * 1.9 + 1.2);
      var organicTreble = 0.1 + 0.08 * Math.sin(t * 2.8 + 0.4);
      var energy = (organicBass + organicMid + organicTreble) / 3;
      return {
        pulse: Math.max(0, Math.min(0.55, organicBass)),
        bass: Math.max(0, Math.min(0.55, organicBass)),
        mid: Math.max(0, Math.min(0.5, organicMid)),
        treble: Math.max(0, Math.min(0.45, organicTreble)),
        energy: Math.max(0, Math.min(0.5, energy))
      };
    }

    function writeCssLevels() {
      var gain = reactiveEnabled ? intensity : 0;
      flowEl.style.setProperty('--pulse', (levels.pulse * gain).toFixed(3));
      flowEl.style.setProperty('--bass', (levels.bass * gain).toFixed(3));
      flowEl.style.setProperty('--mid', (levels.mid * gain).toFixed(3));
      flowEl.style.setProperty('--treble', (levels.treble * gain).toFixed(3));
      flowEl.style.setProperty('--energy', (levels.energy * gain).toFixed(3));
    }

    function tickReactive(audio) {
      if (!playing || !reactiveEnabled) return;
      var next = readLevels(audio);
      levels.pulse = smooth(levels.pulse, next.pulse, 0.14);
      levels.bass = smooth(levels.bass, next.bass, 0.12);
      levels.mid = smooth(levels.mid, next.mid, 0.11);
      levels.treble = smooth(levels.treble, next.treble, 0.1);
      levels.energy = smooth(levels.energy, next.energy, 0.1);
      writeCssLevels();
      rafId = requestAnimationFrame(function() {
        tickReactive(audio);
      });
    }

    function settleDown() {
      cancelAnimationFrame(rafId);
      rafId = 0;
      var step = function() {
        levels.pulse = smooth(levels.pulse, 0, 0.06);
        levels.bass = smooth(levels.bass, 0, 0.06);
        levels.mid = smooth(levels.mid, 0, 0.06);
        levels.treble = smooth(levels.treble, 0, 0.06);
        levels.energy = smooth(levels.energy, 0, 0.06);
        writeCssLevels();
        if (levels.energy > 0.008) {
          rafId = requestAnimationFrame(step);
        }
      };
      rafId = requestAnimationFrame(step);
    }

    function syncReactiveClass() {
      $flow.toggleClass('light-flow--reactive-off', !reactiveEnabled);
      $flow.toggleClass('light-flow--playing', playing && reactiveEnabled);
    }

    function setPlaying(isPlaying, audio) {
      playing = !!isPlaying;
      if (audio) lastAudio = audio;
      syncReactiveClass();
      cancelAnimationFrame(rafId);
      rafId = 0;
      if (playing && reactiveEnabled) {
        tickReactive(audio || lastAudio || null);
      } else {
        settleDown();
      }
    }

    function setReactiveEnabled(enabled) {
      reactiveEnabled = !!enabled;
      try {
        localStorage.setItem(STORAGE_KEY, reactiveEnabled ? '1' : '0');
      } catch (e) {
        /* ignore */
      }
      syncReactiveClass();
      cancelAnimationFrame(rafId);
      rafId = 0;
      if (playing && reactiveEnabled) {
        tickReactive(lastAudio);
      } else {
        settleDown();
      }
    }

    function setIntensity(value) {
      var n = typeof value === 'number' ? value : parseFloat(value);
      if (isNaN(n)) n = 40;
      // 允许传入 0-100 或 0-1；0% 即关闭律动
      intensity = n > 1 ? Math.max(0, Math.min(1, n / 100)) : Math.max(0, Math.min(1, n));
      reactiveEnabled = intensity > 0;
      try {
        localStorage.setItem(INTENSITY_KEY, String(Math.round(intensity * 100)));
        localStorage.setItem(STORAGE_KEY, reactiveEnabled ? '1' : '0');
      } catch (e) {
        /* ignore */
      }
      syncReactiveClass();
      cancelAnimationFrame(rafId);
      rafId = 0;
      writeCssLevels();
      if (playing && reactiveEnabled) {
        tickReactive(lastAudio);
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
            var key = (r >> 4) + ',' + (g >> 4) + ',' + (b >> 4);
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
            opacity: 0.4
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
        paletteTimer = setTimeout(nextIdlePalette, playing ? 16000 : 12000);
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

    syncReactiveClass();
    nextIdlePalette();
    writeCssLevels();

    $(window).on('beforeunload', function() {
      if (paletteTimer) clearTimeout(paletteTimer);
      cancelAnimationFrame(rafId);
    });

    return {
      setPlaying: setPlaying,
      setCover: setCover,
      bindPlayer: bindPlayer,
      setReactiveEnabled: setReactiveEnabled,
      isReactiveEnabled: function() {
        return reactiveEnabled;
      },
      setIntensity: setIntensity,
      getIntensity: function() {
        return intensity;
      }
    };
  }

  var ambientGlow = initLightFlowCycle();
  (function bindAmbientControls() {
    var $range = $('#j-ambient-intensity');
    var $val = $('#j-ambient-intensity-val');
    if (!$range.length || !ambientGlow) return;

    function syncIntensityUi(pct) {
      $range.val(String(pct));
      if ($val.length) $val.text(pct + '%');
      $range.closest('.ambient-intensity').toggleClass('is-off', pct <= 0);
    }

    syncIntensityUi(Math.round(ambientGlow.getIntensity() * 100));

    $range.on('input change', function() {
      var pct = parseInt($range.val(), 10);
      if (isNaN(pct)) pct = 0;
      ambientGlow.setIntensity(pct);
      syncIntensityUi(pct);
    });
  })();

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
        var ajax = function ajax(input, filter, type, pageNo) {
          $.ajax({
            type: 'POST',
            url: getUrl(),
            timeout: 30000,
            data: {
              input: input,
              filter: filter,
              type: type,
              page: pageNo
            },
            dataType: 'json',
            beforeSend: function beforeSend() {
              isload = true;
              loadMoreState.loading = true;
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
              if (pageNo === 1) {
                $('#j-input').attr('disabled', true);
                $('#j-submit').button('loading');
                updateInfiniteLoadState(false, filter);
                setLoadStatus('');
                startSearchProgress();
              } else {
                setLoadStatus('正在加载更多…');
              }
            },
            success: function success(result) {
              if (result.code === 200 && result.data) {
                if (pageNo === 1) {
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
                  if (!v.type && type && type !== '_') {
                    v.type = type;
                  }
                  normalizeTrackMedia(v);
                });
                var setValue = function setValue(data) {
                  var name = data.title + '-' + data.author;
                  $('#j-src').val(data.url);
                  $('#j-src-btn')
                    .attr('href', buildDownloadUrl(data.url, name))
                    .attr('data-save-name', name)
                    .removeAttr('target');
                  $('#j-lrc').text(data.lrc);
                  $('#j-lrc-btn')
                    .attr(
                      'href',
                      'data:application/octet-stream;base64,' +
                        btoa(unescape(encodeURIComponent(data.lrc)))
                    )
                    .attr('download', name + '.lrc')
                    .attr('data-save-name', name);
                  bindNativeDownloadButtons();
                  syncLikeButton(data);
                };

                if (pageNo === 1) {
                  if (player) {
                    player.pause();
                  }

                  playerList = result.data;
                  page = 1;

                  setValue(playerList[0]);
                  addRecent(playerList[0]);
                  syncLikeButton(playerList[0]);
                  persistPlaylistFromPlayer();
                  renderLibrary();

                  $('#j-player').empty();
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
                  player._playbackBound = false;
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

                  loadMoreState.requestNext = function() {
                    if (isload || !loadMoreState.hasMore) return;
                    page += 1;
                    ajax(input, filter, type, page);
                  };
                  // 搜索栏常驻，结果区同页展开
                  showResultMain(true);
                  bindPlaylistInfiniteScroll();
                } else {
                  var prevCount = playerList.length;
                  player.addMusic(result.data);
                  playerList = playerList.concat(result.data);
                  persistPlaylistFromPlayer();
                  renderLibrary();
                  refreshPlayerListAfterAppend(player, {
                    prevCount: prevCount,
                    scrollToNew: false
                  });
                }

                var hasMore =
                  filter === 'name' &&
                  (typeof result.has_more === 'boolean'
                    ? result.has_more
                    : result.data.length >= 10);
                updateInfiniteLoadState(hasMore, filter);
              } else {
                if (pageNo === 1) {
                  $('#j-input')
                    .closest('.am-form-group')
                    .find('.am-alert')
                    .html(result.error || '(°ー°〃) 服务器好像罢工了')
                    .show();
                } else {
                  page = Math.max(1, pageNo - 1);
                  updateInfiniteLoadState(false, filter);
                  setLoadStatus('没有更多了');
                  setTimeout(function() {
                    setLoadStatus('');
                  }, 1200);
                }
              }
            },
            error: function error(e, t) {
              if (pageNo === 1) {
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
                page = Math.max(1, pageNo - 1);
                setLoadStatus('加载失败，继续下滑重试');
              }
            },
            complete: function complete() {
              isload = false;
              loadMoreState.loading = false;
              if (pageNo === 1) {
                stopSearchProgress(searchProgressOk);
                $('#j-input').attr('disabled', false);
                $('#j-submit').button('reset');
              } else if (loadMoreState.hasMore) {
                setLoadStatus('');
              }
              requestAnimationFrame(function() {
                maybeLoadMoreFromScroll();
              });
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

  function normalizeLibTrack(v, item) {
    if (!v.title) v.title = item.title || '暂无';
    if (!v.author) v.author = item.author || '暂无';
    if (!v.pic) v.pic = libCoverUrl(item);
    if (!v.lrc) v.lrc = '[00:00.00] 暂无歌词';
    if (!/\[\d{1,2}:\d{2}/.test(v.lrc)) {
      v.lrc = '[00:00.00] 暂无歌词';
    }
    v.lrc = stripLrcMeta(v.lrc);
    if (!v.type) v.type = item.type;
    if (!v.songid) v.songid = item.songid;
    normalizeTrackMedia(v);
    return v;
  }

  function fetchLibTrack(item) {
    var deferred = $.Deferred();
    if (!item || !item.type || !item.songid) {
      deferred.resolve(null);
      return deferred.promise();
    }
    if (item.type !== 'netease' && item.type !== 'qq') {
      deferred.resolve(null);
      return deferred.promise();
    }
    $.ajax({
      type: 'POST',
      url: getUrl(),
      timeout: 30000,
      data: {
        input: String(item.songid),
        filter: 'id',
        type: item.type,
        page: 1
      },
      dataType: 'json',
      success: function(result) {
        if (!(result.code === 200 && result.data && result.data.length)) {
          deferred.resolve(null);
          return;
        }
        deferred.resolve(normalizeLibTrack(result.data[0], item));
      },
      error: function() {
        deferred.resolve(null);
      }
    });
    return deferred.promise();
  }

  function openPlayerWithTracks(tracks, playIndex, preferType) {
    if (!tracks || !tracks.length) {
      alert('无法播放，歌曲可能已失效');
      return;
    }
    playIndex = Math.max(0, Math.min(playIndex || 0, tracks.length - 1));

    var setValue = function setValue(data) {
      var name = data.title + '-' + data.author;
      $('#j-src').val(data.url);
      $('#j-src-btn')
        .attr('href', buildDownloadUrl(data.url, name))
        .attr('data-save-name', name)
        .removeAttr('target');
      $('#j-lrc').text(data.lrc);
      $('#j-lrc-btn')
        .attr(
          'href',
          'data:application/octet-stream;base64,' +
            btoa(unescape(encodeURIComponent(data.lrc)))
        )
        .attr('download', name + '.lrc')
        .attr('data-save-name', name);
      bindNativeDownloadButtons();
      syncLikeButton(data);
    };

    if (player) {
      try {
        player.pause();
      } catch (e) {}
    }
    playerList = tracks;
    setValue(playerList[playIndex]);
    addRecent(playerList[playIndex]);
    persistPlaylistFromPlayer();
    renderLibrary();

    $('#j-player').empty();
    player = new APlayer({
      element: $('#j-player')[0],
      autoplay: true,
      narrow: false,
      showlrc: 1,
      mutex: false,
      mode: 'circulation',
      preload: 'metadata',
      theme: '#fa2d55',
      music: tracks
    });
    player._playbackBound = false;
    if (typeof player.setMusic === 'function' && playIndex > 0) {
      try {
        player.setMusic(playIndex);
      } catch (e2) {}
    } else {
      player.playIndex = playIndex;
    }
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
      if (playerList[playIndex] && playerList[playIndex].pic) {
        ambientGlow.setCover(playerList[playIndex].pic);
      }
    }
    movePlayButton();
    tunePlayerStudio(player);
    showResultMain(false);
    updateInfiniteLoadState(false, 'id');
    loadMoreState.requestNext = null;
    setLoadStatus('');
    var typeHint = preferType || (tracks[playIndex] && tracks[playIndex].type);
    if (typeHint) setMusicType(typeHint);
    var cur = tracks[playIndex];
    if (cur && cur.songid) {
      pushState(
        document.title,
        getUrl('?id=' + encodeURIComponent(cur.songid) + '&type=' + cur.type)
      );
    }
  }

  function playLibraryItems(items, startIndex) {
    if (!items || !items.length) return;
    startIndex = Math.max(0, Math.min(startIndex || 0, items.length - 1));
    var clicked = items[startIndex];
    $('#j-library').addClass('is-loading');
    startSearchProgress();

    var pending = items.length;
    var slots = new Array(items.length);
    items.forEach(function(item, i) {
      fetchLibTrack(item).always(function(track) {
        slots[i] = track || null;
        pending -= 1;
        if (pending > 0) return;
        $('#j-library').removeClass('is-loading');
        stopSearchProgress(true);
        var tracks = slots.filter(Boolean);
        if (!tracks.length) {
          alert('无法播放，歌曲可能已失效');
          return;
        }
        var playAt = 0;
        if (clicked) {
          var key = libTrackKey(clicked);
          var found = -1;
          tracks.forEach(function(t, idx) {
            if (found < 0 && libTrackKey(t) === key) found = idx;
          });
          if (found >= 0) playAt = found;
        }
        openPlayerWithTracks(tracks, playAt, clicked && clicked.type);
      });
    });
  }

  function playLibraryItem(item) {
    playLibraryItems([item], 0);
  }

  $('#j-like-btn').on('click', function() {
    if (!player || !playerList.length) return;
    var track = playerList[player.playIndex];
    if (!track) return;
    var liked = toggleLike(track);
    syncLikeButton(track);
    renderLibrary();
    $(this).attr('title', liked ? '取消喜欢' : '喜欢');
  });

  $('#j-add-playlist-btn').on('click', function() {
    if (!player || !playerList.length) return;
    var track = playerList[player.playIndex];
    if (!track) return;
    if (isInPlaylist(track)) {
      removeFromPlaylist(track);
    } else {
      enqueueToPlayer(track, function() {
        if (LIB.tab !== 'playlist') {
          LIB.tab = 'playlist';
          $('#j-library .local-library__tab')
            .removeClass('is-active')
            .filter('[data-tab="playlist"]')
            .addClass('is-active');
        }
        syncLikeButton(playerList[player.playIndex] || track);
        renderLibrary();
      });
      return;
    }
    syncLikeButton(playerList[player.playIndex] || track);
    renderLibrary();
  });

  $('#j-library').on('click', '.local-library__chip', function() {
    LIB.channel = $(this).data('channel') || 'all';
    $(this)
      .addClass('is-active')
      .siblings('.local-library__chip')
      .removeClass('is-active');
    renderLibrary();
  });

  $('#j-library').on('click', '.local-library__tab', function() {
    LIB.tab = $(this).data('tab') || 'liked';
    $(this)
      .addClass('is-active')
      .siblings('.local-library__tab')
      .removeClass('is-active');
    renderLibrary();
  });

  $('#j-library-list').on('click', '.local-library__item', function(e) {
    var $target = $(e.target);
    var item = $(this).data('track');
    if (!item) return;
    if ($target.closest('[data-act="unlike"]').length) {
      e.stopPropagation();
      removeLiked(item);
      renderLibrary();
      if (player && playerList[player.playIndex]) {
        syncLikeButton(playerList[player.playIndex]);
      }
      return;
    }
    if ($target.closest('[data-act="like"]').length) {
      e.stopPropagation();
      toggleLike(item);
      renderLibrary();
      if (player && playerList[player.playIndex]) {
        syncLikeButton(playerList[player.playIndex]);
      }
      return;
    }
    if ($target.closest('[data-act="remove-pl"]').length) {
      e.stopPropagation();
      removeFromPlaylist(item);
      renderLibrary();
      if (player && playerList[player.playIndex]) {
        syncLikeButton(playerList[player.playIndex]);
      }
      return;
    }
    if ($target.closest('[data-act="add-pl"]').length) {
      e.stopPropagation();
      // 仅追加到当前播放队列；下次从「喜欢/最近」点播时会被整表替换，中途加入的不算进新上下文
      enqueueToPlayer(item, function() {
        renderLibrary();
        if (player && playerList[player.playIndex]) {
          syncLikeButton(playerList[player.playIndex]);
        }
      });
      return;
    }
    playFromListContext(LIB.tab, item);
  });

  renderLibrary();
  syncLikeButton(null);
});
