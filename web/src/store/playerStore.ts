import { create } from 'zustand';
import type { LoopMode, MusicSource, PlayerStatus, Track } from '../types';
import { fetchTrackById } from '../api';
import { trackKey } from '../types';
import { timedLyricScore } from '../lib/lyrics';

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
    entry: { type: MusicSource; songid: string },
    queue?: { type: MusicSource; songid: string }[],
  ) => Promise<void>;
  patchCurrentLyrics: (lyrics: Pick<Track, 'lrc' | 'yrc' | 'tlyric'>) => void;
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
    const first = await fetchTrackById(entry.type, entry.songid);
    if (!first) {
      set({ status: 'idle', error: '无法播放，歌曲可能已失效' });
      return;
    }
    get().playTracks([first], 0);
    if (!queueEntries?.length) return;
    const resolved = await Promise.all(
      queueEntries.map(async (item) => {
        if (item.type === first.type && String(item.songid) === String(first.songid)) return first;
        return fetchTrackById(item.type, item.songid);
      }),
    );
    const tracks = resolved.filter((item): item is Track => Boolean(item));
    const index = Math.max(
      0,
      tracks.findIndex((item) => trackKey(item) === trackKey(first)),
    );
    if (tracks.length) {
      set({ queue: tracks, index: index < 0 ? 0 : index });
    }
  },
  patchCurrentLyrics: (lyrics) => {
    const { queue, index } = get();
    const current = queue[index];
    if (!current) return;
    const nextLrc = timedLyricScore(lyrics.lrc) >= timedLyricScore(current.lrc)
      ? (lyrics.lrc || current.lrc)
      : current.lrc;
    const nextYrc = timedLyricScore(lyrics.yrc) >= timedLyricScore(current.yrc)
      ? (lyrics.yrc || current.yrc || '')
      : (current.yrc || '');
    const nextTlyric = timedLyricScore(lyrics.tlyric) >= timedLyricScore(current.tlyric)
      ? (lyrics.tlyric || current.tlyric || '')
      : (current.tlyric || '');
    if (
      current.lrc === nextLrc
      && (current.yrc || '') === nextYrc
      && (current.tlyric || '') === nextTlyric
    ) {
      return;
    }
    const next = queue.slice();
    next[index] = {
      ...current,
      lrc: nextLrc,
      yrc: nextYrc,
      tlyric: nextTlyric,
    };
    set({ queue: next });
  },
}));
