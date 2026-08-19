import { create } from 'zustand';
import type { LoopMode, MusicSource, PlayerStatus, Track } from '../types';
import { fetchSignedMedia } from '../api';
import { trackKey } from '../types';
import { effectiveTimedLyricScore } from '../lib/lyrics';

interface PlayerState {
  source: MusicSource;
  queue: Track[];
  index: number;
  status: PlayerStatus;
  duration: number;
  loopMode: LoopMode;
  error: string;
  setSource: (source: MusicSource) => void;
  setDuration: (duration: number) => void;
  setStatus: (status: PlayerStatus) => void;
  setError: (error: string) => void;
  toggleLoop: () => void;
  playTracks: (tracks: Track[], index?: number) => void;
  addToQueue: (track: Track) => void;
  playLibraryEntry: (
    entry: { type: MusicSource; songid: string; title?: string; author?: string; delisted?: boolean },
    queue?: { type: MusicSource; songid: string; title?: string; author?: string; delisted?: boolean }[],
  ) => Promise<void>;
  patchCurrentLyrics: (
    lyrics: Pick<Track, 'lrc' | 'yrc' | 'tlyric' | 'lyricSource'>,
    options?: { replace?: boolean },
  ) => void;
}

const LOOP_ORDER: LoopMode[] = ['off', 'all', 'one'];

export const usePlayerStore = create<PlayerState>((set, get) => ({
  source: 'netease',
  queue: [],
  index: 0,
  status: 'idle',
  duration: 0,
  loopMode: 'all',
  error: '',
  setSource: (source) => set({ source }),
  setDuration: (duration) => set({ duration }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  toggleLoop: () => {
    const current = get().loopMode;
    set({ loopMode: LOOP_ORDER[(LOOP_ORDER.indexOf(current) + 1) % LOOP_ORDER.length] });
  },
  playTracks: (tracks, index = 0) => {
    if (!tracks.length) return;
    const safeIndex = Math.max(0, Math.min(index, tracks.length - 1));
    const track = tracks[safeIndex];
    set({
      queue: tracks,
      index: safeIndex,
      status: 'loading',
      duration: 0,
      error: '',
      source: track.type,
    });
  },
  addToQueue: (track) => {
    const queue = get().queue;
    if (queue.some((item) => trackKey(item) === trackKey(track))) return;
    set({ queue: [...queue, track] });
  },
  playLibraryEntry: async (entry, queueEntries) => {
    set({ status: 'loading', error: '' });
    const signed = await fetchSignedMedia(entry.type, entry.songid, {
      title: entry.title || '',
      author: entry.author || '',
      delisted: entry.delisted,
    });
    if (!signed?.url) {
      set({ status: 'idle', error: '无法播放，歌曲可能已失效' });
      return;
    }
    const first: Track = {
      type: entry.type,
      songid: String(entry.songid),
      title: entry.title || '未知曲目',
      author: entry.author || '',
      lrc: '',
      url: signed.url,
      pic: signed.pic,
      ...(signed.delisted || entry.delisted ? { delisted: true } : {}),
    };
    get().playTracks([first], 0);
    if (!queueEntries?.length) return;
    window.setTimeout(() => {
      void (async () => {
        const current = get().queue[get().index];
        if (!current || trackKey(current) !== trackKey(first)) return;
        // 保留当前已匹配的歌词：重建队列时不能用初始空 first 覆盖
        const liveFirst: Track = {
          ...first,
          lrc: current.lrc || '',
          yrc: current.yrc || '',
          tlyric: current.tlyric || '',
          lyricSource: current.lyricSource,
          delisted: current.delisted || first.delisted,
          pic: current.pic || first.pic,
          url: current.url || first.url,
        };
        const resolved = await Promise.all(
          queueEntries.map(async (item) => {
            if (item.type === first.type && String(item.songid) === String(first.songid)) {
              const latest = get().queue[get().index];
              if (latest && trackKey(latest) === trackKey(first)) {
                return {
                  ...liveFirst,
                  lrc: latest.lrc || liveFirst.lrc,
                  yrc: latest.yrc || liveFirst.yrc,
                  tlyric: latest.tlyric || liveFirst.tlyric,
                  lyricSource: latest.lyricSource || liveFirst.lyricSource,
                } satisfies Track;
              }
              return liveFirst;
            }
            const signedItem = await fetchSignedMedia(item.type, item.songid, {
              title: item.title,
              author: item.author,
              delisted: item.delisted,
            });
            if (!signedItem?.url) return null;
            return {
              type: item.type,
              songid: String(item.songid),
              title: item.title || '未知曲目',
              author: item.author || '',
              lrc: '',
              url: signedItem.url,
              pic: signedItem.pic,
              ...(signedItem.delisted || item.delisted ? { delisted: true } : {}),
            } satisfies Track;
          }),
        );
        if (trackKey(get().queue[get().index] || first) !== trackKey(first)) return;
        const tracks = resolved.filter((item): item is Track => Boolean(item));
        const index = Math.max(
          0,
          tracks.findIndex((item) => trackKey(item) === trackKey(first)),
        );
        if (tracks.length) {
          // 再并一次：签名队列拉取期间歌词可能刚写完
          const latest = get().queue[get().index];
          if (latest && trackKey(latest) === trackKey(first) && index >= 0) {
            tracks[index] = {
              ...tracks[index],
              lrc: latest.lrc || tracks[index].lrc,
              yrc: latest.yrc || tracks[index].yrc,
              tlyric: latest.tlyric || tracks[index].tlyric,
              lyricSource: latest.lyricSource || tracks[index].lyricSource,
              pic: latest.pic || tracks[index].pic,
              url: latest.url || tracks[index].url,
              delisted: latest.delisted || tracks[index].delisted,
            };
          }
          set({ queue: tracks, index: index < 0 ? 0 : index });
        }
      })();
    }, 400);
  },
  patchCurrentLyrics: (lyrics, options) => {
    const { queue, index } = get();
    const current = queue[index];
    if (!current) return;
    const replace = Boolean(options?.replace);
    const score = (text?: string) => effectiveTimedLyricScore(text);
    const nextLrc = replace || score(lyrics.lrc) >= score(current.lrc)
      ? (lyrics.lrc || (replace ? '' : current.lrc))
      : current.lrc;
    const nextYrc = replace || score(lyrics.yrc) >= score(current.yrc)
      ? (lyrics.yrc || (replace ? '' : current.yrc || ''))
      : (current.yrc || '');
    const nextTlyric = replace || score(lyrics.tlyric) >= score(current.tlyric)
      ? (lyrics.tlyric || (replace ? '' : current.tlyric || ''))
      : (current.tlyric || '');
    const nextSource = lyrics.lyricSource || current.lyricSource;
    if (
      current.lrc === nextLrc
      && (current.yrc || '') === nextYrc
      && (current.tlyric || '') === nextTlyric
      && current.lyricSource === nextSource
    ) {
      return;
    }
    const next = queue.slice();
    next[index] = {
      ...current,
      lrc: nextLrc,
      yrc: nextYrc,
      tlyric: nextTlyric,
      lyricSource: nextSource,
    };
    set({ queue: next });
  },
}));
