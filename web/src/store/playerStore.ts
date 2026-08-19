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
    const prevQueue = get().queue;
    const lyricByKey = new Map(
      prevQueue.map((item) => [trackKey(item), item] as const),
    );
    const merged = tracks.map((track) => {
      const prev = lyricByKey.get(trackKey(track));
      if (!prev) return track;
      const keepLyrics = effectiveTimedLyricScore(prev.yrc) + effectiveTimedLyricScore(prev.lrc)
        > effectiveTimedLyricScore(track.yrc) + effectiveTimedLyricScore(track.lrc);
      if (!keepLyrics) return track;
      return {
        ...track,
        lrc: prev.lrc || track.lrc,
        yrc: prev.yrc || track.yrc,
        tlyric: prev.tlyric || track.tlyric,
        lyricSource: prev.lyricSource || track.lyricSource,
      };
    });
    const track = merged[safeIndex];
    const sameAsCurrent = prevQueue[get().index]
      && trackKey(prevQueue[get().index]) === trackKey(track);
    set({
      queue: merged,
      index: safeIndex,
      status: sameAsCurrent && (get().status === 'playing' || get().status === 'paused')
        ? get().status
        : 'loading',
      // 同一首继续播时不要把 duration 清零，避免进度/歌词状态抖动
      duration: sameAsCurrent ? get().duration : 0,
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
    const entryKey = `${entry.type}:${String(entry.songid)}`;
    const state = get();
    const current = state.queue[state.index];
    const sameAsCurrent = Boolean(
      current
      && current.type === entry.type
      && String(current.songid) === String(entry.songid),
    );

    // 正在播同一首：保留歌词与进度，只补齐队列，避免空歌词覆盖
    if (sameAsCurrent && current?.url) {
      if (!queueEntries?.length) return;
      const kept = { ...current };
      window.setTimeout(() => {
        void (async () => {
          const latest = get().queue[get().index];
          if (!latest || trackKey(latest) !== trackKey(kept)) return;
          const live = {
            ...kept,
            lrc: latest.lrc || kept.lrc,
            yrc: latest.yrc || kept.yrc,
            tlyric: latest.tlyric || kept.tlyric,
            lyricSource: latest.lyricSource || kept.lyricSource,
          };
          const resolved = await Promise.all(
            queueEntries.map(async (item) => {
              if (`${item.type}:${String(item.songid)}` === entryKey) return live;
              const existing = get().queue.find(
                (row) => row.type === item.type && String(row.songid) === String(item.songid),
              );
              if (existing?.url) return existing;
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
          if (trackKey(get().queue[get().index] || live) !== trackKey(live)) return;
          const tracks = resolved.filter((item): item is Track => Boolean(item));
          const index = Math.max(0, tracks.findIndex((item) => trackKey(item) === trackKey(live)));
          if (!tracks.length) return;
          const again = get().queue[get().index];
          if (again && trackKey(again) === trackKey(live) && index >= 0) {
            tracks[index] = {
              ...tracks[index],
              lrc: again.lrc || tracks[index].lrc,
              yrc: again.yrc || tracks[index].yrc,
              tlyric: again.tlyric || tracks[index].tlyric,
              lyricSource: again.lyricSource || tracks[index].lyricSource,
              url: again.url || tracks[index].url,
              pic: again.pic || tracks[index].pic,
            };
          }
          set({ queue: tracks, index: index < 0 ? 0 : index });
        })();
      }, 0);
      return;
    }

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
    const prev = state.queue.find(
      (row) => row.type === entry.type && String(row.songid) === String(entry.songid),
    );
    const first: Track = {
      type: entry.type,
      songid: String(entry.songid),
      title: entry.title || '未知曲目',
      author: entry.author || '',
      lrc: prev?.lrc || '',
      yrc: prev?.yrc || '',
      tlyric: prev?.tlyric || '',
      lyricSource: prev?.lyricSource,
      url: signed.url,
      pic: signed.pic || prev?.pic || '',
      ...(signed.delisted || entry.delisted || prev?.delisted ? { delisted: true } : {}),
    };
    get().playTracks([first], 0);
    if (!queueEntries?.length) return;
    window.setTimeout(() => {
      void (async () => {
        const playing = get().queue[get().index];
        if (!playing || trackKey(playing) !== trackKey(first)) return;
        // 保留当前已匹配的歌词：重建队列时不能用初始空 first 覆盖
        const liveFirst: Track = {
          ...first,
          lrc: playing.lrc || first.lrc || '',
          yrc: playing.yrc || first.yrc || '',
          tlyric: playing.tlyric || first.tlyric || '',
          lyricSource: playing.lyricSource || first.lyricSource,
          delisted: playing.delisted || first.delisted,
          pic: playing.pic || first.pic,
          url: playing.url || first.url,
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
