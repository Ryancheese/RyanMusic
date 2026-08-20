import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import {
  addNeteasePlaylistTrack,
  addQqPlaylistTrack,
  type CloudPlaylist,
} from '../api';
import { useCloudStore } from '../store/cloudStore';
import { getPlaylistRecentAt, touchPlaylistRecent } from '../store/playlistRecentStore';
import { showToast } from '../store/toastStore';
import type { MusicSource, ThemeTokens, Track } from '../types';
import RyanLoader from './RyanLoader';

interface AddToPlaylistModalProps {
  open: boolean;
  isDaylight: boolean;
  theme: ThemeTokens;
  track: Track | null;
  onClose: () => void;
}

type SortMode = 'created' | 'recent';

function providerLabel(type: MusicSource): string {
  if (type === 'netease') return '网易云音乐';
  if (type === 'qq') return 'QQ 音乐';
  return type;
}

function isOwnedPlaylist(playlist: CloudPlaylist): boolean {
  return !playlist.subscribed;
}

function sortOwnedPlaylists(
  list: CloudPlaylist[],
  provider: MusicSource,
  mode: SortMode,
): CloudPlaylist[] {
  const owned = list.filter(isOwnedPlaylist);
  if (mode === 'recent') {
    return [...owned].sort((a, b) => {
      const recentDiff = getPlaylistRecentAt(provider, b.id) - getPlaylistRecentAt(provider, a.id);
      if (recentDiff !== 0) return recentDiff;
      return (a.order ?? 0) - (b.order ?? 0);
    });
  }
  return [...owned].sort((a, b) => {
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return (b.createTime || 0) - (a.createTime || 0);
  });
}

const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  open,
  isDaylight,
  theme,
  track,
  onClose,
}) => {
  const neteasePlaylists = useCloudStore((state) => state.neteasePlaylists);
  const qqPlaylists = useCloudStore((state) => state.qqPlaylists);
  const neteaseSyncing = useCloudStore((state) => state.neteaseSyncing);
  const qqSyncing = useCloudStore((state) => state.qqSyncing);
  const syncNetease = useCloudStore((state) => state.syncNetease);
  const syncQq = useCloudStore((state) => state.syncQq);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('created');

  const provider = track?.type;
  const playlists = useMemo(() => {
    if (provider === 'netease') return sortOwnedPlaylists(neteasePlaylists, 'netease', sortMode);
    if (provider === 'qq') return sortOwnedPlaylists(qqPlaylists, 'qq', sortMode);
    return [];
  }, [neteasePlaylists, provider, qqPlaylists, sortMode]);

  const loading = provider === 'netease' ? neteaseSyncing : provider === 'qq' ? qqSyncing : false;

  useEffect(() => {
    if (!open || !track) return;
    setSortMode('created');
    if (track.type === 'netease' && !neteasePlaylists.length) {
      void syncNetease();
    } else if (track.type === 'qq' && !qqPlaylists.length) {
      void syncQq();
    }
  }, [neteasePlaylists.length, open, qqPlaylists.length, syncNetease, syncQq, track]);

  useEffect(() => {
    if (!open) setAddingId(null);
  }, [open]);

  const handleAdd = useCallback(async (playlist: CloudPlaylist) => {
    if (!track || addingId) return;
    setAddingId(playlist.id);
    try {
      if (track.type === 'netease') {
        const res = await addNeteasePlaylistTrack(playlist.id, track.songid);
        if (res.code !== 200) throw new Error(res.error || '添加失败');
        touchPlaylistRecent('netease', playlist.id);
      } else if (track.type === 'qq') {
        const res = await addQqPlaylistTrack({
          playlistId: playlist.id,
          songid: track.songid,
          dirid: playlist.dirid,
        });
        if (res.code !== 200) throw new Error(res.error || '添加失败');
        touchPlaylistRecent('qq', playlist.id);
      } else {
        throw new Error('当前音源暂不支持添加到歌单');
      }
      showToast({
        kind: 'success',
        title: '已添加到歌单',
        detail: playlist.name,
      });
    } catch (error) {
      showToast({
        kind: 'error',
        title: '添加失败',
        detail: error instanceof Error ? error.message : '请稍后重试',
      });
    } finally {
      setAddingId(null);
    }
  }, [addingId, track]);

  if (!open || !track) return null;

  const panelClass = isDaylight
    ? 'border-black/10 bg-[color-mix(in_srgb,var(--bg-color)_94%,white)] text-black'
    : 'border-white/10 bg-[color-mix(in_srgb,var(--bg-color)_88%,black)] text-white';
  const rowClass = isDaylight
    ? 'border-black/8 bg-black/[0.03] hover:bg-black/[0.06]'
    : 'border-white/8 bg-white/[0.04] hover:bg-white/[0.07]';
  const sortChip = (mode: SortMode, label: string) => {
    const active = sortMode === mode;
    return (
      <button
        type="button"
        onClick={() => setSortMode(mode)}
        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
          active
            ? (isDaylight ? 'bg-black/10 text-black' : 'bg-white/14 text-white')
            : 'opacity-45 hover:opacity-80'
        }`}
      >
        {label}
      </button>
    );
  };

  const body = (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="关闭"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className={`relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-3xl border shadow-2xl ${panelClass}`}
        style={{ maxHeight: 'min(28rem, calc(100dvh - 3rem))' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-6 pb-2 pt-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">添加到歌单</h2>
            <p className="mt-1 text-xs opacity-45">{providerLabel(provider)} · 我创建的歌单</p>
          </div>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="rounded-full p-2 opacity-50 transition hover:bg-white/10 hover:opacity-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 px-6 pb-3">
          {sortChip('created', '创建顺序')}
          {sortChip('recent', '最近收听')}
        </div>

        <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-1">
          {loading && !playlists.length ? (
            <div className="flex min-h-[12rem] items-center justify-center">
              <RyanLoader size={32} label="正在加载歌单…" />
            </div>
          ) : playlists.length ? (
            <ul className="space-y-2.5">
              {playlists.map((playlist) => {
                const busy = addingId === playlist.id;
                return (
                  <li key={playlist.id}>
                    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition ${rowClass}`}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-medium">{playlist.name}</div>
                        <div className="mt-0.5 text-xs opacity-40">
                          {playlist.trackCount ?? 0} 首歌曲
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busy || !!addingId}
                        aria-label={`添加到 ${playlist.name}`}
                        onClick={() => void handleAdd(playlist)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:opacity-40"
                        style={{
                          color: 'var(--text-on-accent)',
                          background: 'var(--text-accent)',
                        }}
                      >
                        {busy ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Plus size={18} strokeWidth={2.25} />
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 px-4 text-center text-sm opacity-45">
              <p>还没有可编辑的创建歌单</p>
              <p className="text-xs opacity-70">收藏的歌单无法添加歌曲，请先在 {providerLabel(provider)} 创建歌单</p>
            </div>
          )}
        </div>

        {track.title ? (
          <div
            className={`shrink-0 border-t px-6 py-3 text-xs opacity-45 ${isDaylight ? 'border-black/10' : 'border-white/10'}`}
          >
            <span className="truncate" style={{ color: theme.primaryColor }}>
              {track.title}
            </span>
            {track.author ? <span className="opacity-70"> · {track.author}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return body;
  return createPortal(body, document.body);
};

export default AddToPlaylistModal;
