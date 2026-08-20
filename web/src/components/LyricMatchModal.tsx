import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MotionValue } from 'framer-motion';
import { Check, Search, X } from 'lucide-react';
import type { LyricSearchCandidate } from '../api';
import { coverImageUrl, fetchTrackLyrics, searchLyricCandidates } from '../api';
import { hasUsableTrackLyrics, resolveVisualizerLyrics } from '../lib/lyrics';
import { LYRIC_SOURCE_OPTIONS, useLyricSettingsStore } from '../store/lyricSettingsStore';
import { useLyricMatchStore, type ManualLyricSelection } from '../store/lyricMatchStore';
import type { Line, LyricProviderSource, ThemeTokens, Track } from '../types';
import CoverArt from './CoverArt';
import RyanLoader from './RyanLoader';
import WordByWordBadge from './WordByWordBadge';
import LyricPreviewKaraoke from './LyricPreviewKaraoke';

const AUTO_PICK_MIN_SCORE = 75;

interface LyricMatchModalProps {
  open: boolean;
  isDaylight: boolean;
  theme: ThemeTokens;
  track: Track | null;
  currentTime: MotionValue<number>;
  durationSec?: number;
  onClose: () => void;
  onSave: (candidate: LyricSearchCandidate) => Promise<void>;
}

function candidateKey(candidate: LyricSearchCandidate): string {
  return `${candidate.provider}:${candidate.amllPlatform || ''}:${candidate.providerSongId}`;
}

function defaultSearchQuery(track: Track): string {
  return [track.title, track.author].filter(Boolean).join(' - ');
}

function matchScoreColor(score: number, isDaylight: boolean): string {
  if (score >= 75) return isDaylight ? '#0284c7' : '#7dd3fc';
  if (score >= 60) return isDaylight ? '#d97706' : '#fcd34d';
  return isDaylight ? '#71717a' : 'rgba(255,255,255,0.45)';
}

function displayTitle(value?: string): string {
  const text = String(value || '').replace(/<[^>]+>/g, '').trim();
  return text || '未知曲目';
}

function displayArtist(value?: string): string {
  const text = String(value || '').replace(/<[^>]+>/g, '').trim();
  return text || '未知艺人';
}

function initialSourceTab(track: Track | null, preferred: LyricProviderSource): LyricProviderSource {
  const current = track?.lyricSource;
  if (current === 'netease' || current === 'amll' || current === 'qq' || current === 'kugou') {
    return current;
  }
  return preferred;
}

function trackKey(track: Track): string {
  return `${track.type}:${track.songid}`;
}

function resolvePreferredProviderSongId(
  track: Track,
  source: LyricProviderSource,
  manual: ManualLyricSelection | null,
): string | null {
  if (manual?.provider === source) return String(manual.providerSongId);
  if (track.lyricSource === source && track.lyricProviderSongId) {
    return String(track.lyricProviderSongId);
  }
  if (track.type === source) return String(track.songid);
  return null;
}

function buildPlayingCandidate(track: Track, source: LyricProviderSource): LyricSearchCandidate | null {
  if (track.type !== source) return null;
  return {
    provider: source,
    providerSongId: String(track.songid),
    title: track.title,
    artist: track.author,
    album: track.album || '',
    durationMs: track.durationMs || 0,
    pic: track.pic,
    matchScore: 100,
    titleMatched: true,
    artistMatched: true,
  };
}

function mergePlayingCandidate(
  list: LyricSearchCandidate[],
  track: Track,
  source: LyricProviderSource,
): LyricSearchCandidate[] {
  const playing = buildPlayingCandidate(track, source);
  if (!playing) return list;
  const exists = list.some(
    (item) => item.provider === source && String(item.providerSongId) === playing.providerSongId,
  );
  if (exists) return list;
  return [playing, ...list];
}

function pickBestCandidate(
  list: LyricSearchCandidate[],
  autoUseBest: boolean,
  track: Track,
  source: LyricProviderSource,
  manual: ManualLyricSelection | null,
): LyricSearchCandidate | null {
  if (!list.length) return null;

  const preferId = resolvePreferredProviderSongId(track, source, manual);
  if (preferId) {
    const exact = list.find(
      (item) => item.provider === source && String(item.providerSongId) === preferId,
    );
    if (exact) {
      if (!autoUseBest && exact.matchScore < 60) return exact;
      if (autoUseBest && exact.matchScore < AUTO_PICK_MIN_SCORE) return exact;
      return exact;
    }
  }

  const ranked = [...list].sort((a, b) => b.matchScore - a.matchScore);
  const best = ranked[0];
  if (autoUseBest && best.matchScore < AUTO_PICK_MIN_SCORE) return null;
  if (!autoUseBest && best.matchScore < 60) return null;
  return best;
}

const LyricMatchModal: React.FC<LyricMatchModalProps> = ({
  open,
  isDaylight,
  theme,
  track,
  currentTime,
  durationSec = 0,
  onClose,
  onSave,
}) => {
  const [sourceTab, setSourceTab] = useState<LyricProviderSource>('netease');
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<LyricSearchCandidate[]>([]);
  const [picked, setPicked] = useState<LyricSearchCandidate | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewBundle, setPreviewBundle] = useState<{ lrc: string; yrc: string; tlyric?: string } | null>(null);
  const searchGen = useRef(0);
  const previewGen = useRef(0);
  const lyricsCache = useRef(new Map<string, { lrc: string; yrc: string; tlyric?: string }>());
  const preferredSource = useLyricSettingsStore((state) => state.preferredSource);
  const autoUseBest = useLyricSettingsStore((state) => state.autoUseBest);
  const manualSelection = useLyricMatchStore((state) => (
    track ? state.manualByTrackKey[trackKey(track)] || null : null
  ));
  const lyricFilterPattern = useLyricSettingsStore((state) => (
    state.filterEnabled ? state.filterPattern : ''
  ));

  const panel = isDaylight ? 'bg-white/95 text-black' : 'bg-zinc-950/96 text-white';
  const subtle = isDaylight ? 'border-black/10 bg-black/[0.03]' : 'border-white/10 bg-white/[0.04]';
  const inputClass = isDaylight
    ? 'bg-black/[0.04] text-black placeholder:text-black/35'
    : 'bg-white/[0.06] text-white placeholder:text-white/35';

  const pickedKey = picked ? candidateKey(picked) : '';
  const sourceLabel = picked
    ? (LYRIC_SOURCE_OPTIONS.find((item) => item.id === picked.provider)?.label || picked.provider)
    : '';

  const previewResolved = useMemo(() => {
    if (!previewBundle) return { lines: [] as Line[], isWordByWord: false };
    return resolveVisualizerLyrics(previewBundle, lyricFilterPattern);
  }, [lyricFilterPattern, previewBundle]);

  const stageResolved = useMemo(
    () => resolveVisualizerLyrics(track, lyricFilterPattern),
    [lyricFilterPattern, track],
  );

  const stageMismatch = useMemo(() => {
    if (!track || !picked || !previewBundle || !previewResolved.lines.length) return false;
    if (!stageResolved.lines.length) return true;
    const stageFirst = stageResolved.lines.find((line) => (line.fullText || '').trim())?.fullText || '';
    const previewFirst = previewResolved.lines.find((line) => (line.fullText || '').trim())?.fullText || '';
    if (stageFirst && previewFirst && stageFirst !== previewFirst) return true;
    return Math.abs(stageResolved.lines.length - previewResolved.lines.length) > 3;
  }, [picked, previewBundle, previewResolved.lines, stageResolved.lines, track]);

  const runSearch = useCallback(async (
    nextQuery: string,
    source: LyricProviderSource,
    mode: 'autoPick' | 'keepPick',
  ) => {
    if (!track) return;
    const gen = ++searchGen.current;
    setSearching(true);
    try {
      const durationMs = durationSec > 0
        ? durationSec * 1000
        : (track.durationMs || 0);
      const list = mergePlayingCandidate(
        await searchLyricCandidates({
          title: track.title,
          artist: track.author,
          durationMs,
          source,
          query: nextQuery.trim() || defaultSearchQuery(track),
          nativeSongId: track.type === source ? String(track.songid) : '',
          nativeSource: track.type === source ? track.type : undefined,
        }),
        track,
        source,
      );
      if (gen !== searchGen.current) return;
      setCandidates(list);
      const nextPick = pickBestCandidate(list, autoUseBest, track, source, manualSelection);
      if (mode === 'autoPick') {
        setPicked(nextPick);
      } else {
        setPicked((prev) => prev ?? nextPick);
      }
    } finally {
      if (gen === searchGen.current) setSearching(false);
    }
  }, [autoUseBest, durationSec, manualSelection, track]);

  useEffect(() => {
    if (!open || !track) return;
    const initialQuery = defaultSearchQuery(track);
    lyricsCache.current.clear();
    setQuery(initialQuery);
    setPicked(null);
    setPreviewBundle(null);
    const initialTab = initialSourceTab(track, preferredSource);
    setSourceTab(initialTab);
    void runSearch(initialQuery, initialTab, 'autoPick');
  }, [open, preferredSource, runSearch, track]);

  useEffect(() => {
    if (!open || !track || !picked) {
      setPreviewBundle(null);
      setPreviewLoading(false);
      return;
    }
    const key = candidateKey(picked);
    const cached = lyricsCache.current.get(key);
    if (cached) {
      setPreviewBundle(cached);
      setPreviewLoading(false);
      return;
    }
    const gen = ++previewGen.current;
    setPreviewLoading(true);
    setPreviewBundle(null);
    void (async () => {
      try {
        const lyrics = await fetchTrackLyrics({
          type: track.type,
          songid: track.songid,
          title: picked.title,
          artist: picked.artist,
          album: picked.album,
          durationMs: picked.durationMs || (durationSec > 0 ? durationSec * 1000 : 0),
          preferred: picked.provider,
          providerSongId: picked.providerSongId,
          kgHash: picked.kgHash,
          amllPlatform: picked.amllPlatform,
          forceSource: true,
        });
        if (gen !== previewGen.current) return;
        if (!lyrics || !hasUsableTrackLyrics(lyrics)) {
          setPreviewBundle(null);
          return;
        }
        const bundle = { lrc: lyrics.lrc || '', yrc: lyrics.yrc || '', tlyric: lyrics.tlyric };
        lyricsCache.current.set(key, bundle);
        setPreviewBundle(bundle);
      } catch {
        if (gen !== previewGen.current) return;
        setPreviewBundle(null);
      } finally {
        if (gen === previewGen.current) setPreviewLoading(false);
      }
    })();
  }, [durationSec, open, picked, track]);

  if (!open || !track) return null;

  const handleSave = async () => {
    if (!picked || saving) return;
    setSaving(true);
    try {
      await onSave(picked);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-5">
      <button type="button" className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} aria-label="关闭" />
      <div
        className={`relative z-10 flex h-[min(88vh,720px)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border shadow-2xl ${panel}`}
        style={{ color: theme.primaryColor, borderColor: isDaylight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)' }}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: isDaylight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">匹配歌词</h2>
            <p className="mt-0.5 truncate text-sm opacity-55">{track.title}</p>
          </div>
          <button type="button" className="rounded-full p-1.5 opacity-60 transition hover:opacity-100" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col border-b lg:border-b-0 lg:border-r" style={{ borderColor: isDaylight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>
            <div className="flex shrink-0 gap-1 overflow-x-auto px-4 pt-3 hide-scrollbar">
              {LYRIC_SOURCE_OPTIONS.map((item) => {
                const active = sourceTab === item.id;
                const pickedHere = picked?.provider === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSourceTab(item.id);
                      void runSearch(query, item.id, 'keepPick');
                    }}
                    className={`shrink-0 border-b-2 px-3 pb-2 text-sm transition ${
                      active
                        ? 'border-[var(--text-accent)] font-medium opacity-100'
                        : 'border-transparent opacity-50 hover:opacity-80'
                    }`}
                    style={active ? { color: 'var(--text-accent)' } : undefined}
                  >
                    {item.label}
                    {pickedHere ? <span className="ml-1 text-[10px] opacity-70">●</span> : null}
                  </button>
                );
              })}
            </div>

            <div className="flex shrink-0 items-center gap-2 px-4 py-3">
              <div className={`flex min-w-0 flex-1 items-center gap-2 rounded-2xl border px-3 py-2 ${subtle}`}>
                <Search size={16} className="shrink-0 opacity-45" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void runSearch(query, sourceTab, 'autoPick');
                  }}
                  className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${inputClass}`}
                  placeholder="搜索歌名、歌手或专辑"
                />
              </div>
              <button
                type="button"
                disabled={searching}
                onClick={() => void runSearch(query, sourceTab, 'autoPick')}
                className="shrink-0 rounded-2xl px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
                style={{ backgroundColor: 'var(--text-accent)' }}
              >
                搜索
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 hide-scrollbar">
              {searching && !candidates.length ? (
                <div className="flex h-full min-h-[12rem] items-center justify-center">
                  <RyanLoader size={28} />
                </div>
              ) : !candidates.length ? (
                <div className="flex h-full min-h-[12rem] items-center justify-center text-sm opacity-45">
                  未找到匹配结果，试试换个关键词或来源
                </div>
              ) : (
                <ul className="space-y-2 pr-1">
                  {candidates.map((item) => {
                    const key = candidateKey(item);
                    const active = key === pickedKey;
                    const isPlayingTrack = track.type === item.provider
                      && String(track.songid) === String(item.providerSongId);
                    const coverSrc = item.pic ? coverImageUrl(item.pic, 120) : '';
                    return (
                      <li key={key} className="flex items-stretch gap-2">
                        <button
                          type="button"
                          onClick={() => setPicked(item)}
                          className={`relative flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-2xl border p-2.5 text-left transition ${
                            active
                              ? 'border-[var(--text-accent)] bg-[color-mix(in_srgb,var(--text-accent)_10%,transparent)]'
                              : isDaylight
                                ? 'border-black/8 hover:border-black/14 hover:bg-black/[0.02]'
                                : 'border-white/8 hover:border-white/14 hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                            <CoverArt
                              src={coverSrc}
                              alt=""
                              className="h-full w-full"
                              size={120}
                              flipOnLoad={false}
                            />
                          </div>
                          <div className="min-w-0 flex-1 pr-6">
                            <p className="truncate text-sm font-medium leading-snug">{displayTitle(item.title)}</p>
                            <p className="mt-0.5 truncate text-xs opacity-55">{displayArtist(item.artist)}</p>
                            <p className="truncate text-[11px] opacity-40">
                              {isPlayingTrack ? '正在播放 · ' : ''}{item.album?.trim() || '未知专辑'}
                            </p>
                          </div>
                          {active ? (
                            <span
                              className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-white"
                              style={{ backgroundColor: 'var(--text-accent)' }}
                            >
                              <Check size={12} strokeWidth={3} />
                            </span>
                          ) : null}
                        </button>
                        <div className="flex w-12 shrink-0 items-center justify-center">
                          <span
                            className="text-sm font-bold tabular-nums"
                            style={{ color: matchScoreColor(item.matchScore, isDaylight) }}
                          >
                            {item.matchScore}%
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col lg:w-[340px] xl:w-[380px]">
            <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium opacity-45">
                    {picked ? `候选预览 · ${sourceLabel}` : '候选预览'}
                  </p>
                  <p className="truncate text-sm font-semibold">
                    {picked ? displayTitle(picked.title) : '尚未选择候选'}
                  </p>
                  <p className="truncate text-xs opacity-50">
                    {picked ? displayArtist(picked.artist) : '点左侧一条，按当前播放进度试听歌词'}
                  </p>
                </div>
                {previewResolved.isWordByWord ? <WordByWordBadge compact /> : null}
              </div>
              <div className={`relative min-h-0 flex-1 overflow-hidden rounded-2xl border p-4 ${subtle}`}>
                {previewLoading ? (
                  <div className="flex h-full min-h-[10rem] items-center justify-center">
                    <RyanLoader size={22} />
                  </div>
                ) : (
                  <LyricPreviewKaraoke
                    lines={previewResolved.lines}
                    currentTime={currentTime}
                    wordByWord={previewResolved.isWordByWord}
                    fullList
                    emptyHint={picked ? '该候选暂无可用歌词' : '选择左侧候选以预览是否跟节奏'}
                  />
                )}
              </div>
              {picked && previewResolved.lines.length > 0 ? (
                <p className="mt-2 text-center text-[11px] opacity-40">
                  共 {previewResolved.lines.filter((line) => (line.fullText || '').trim()).length} 行
                </p>
              ) : null}
              {stageMismatch ? (
                <p className="mt-2 rounded-xl px-3 py-2 text-center text-[11px] leading-relaxed" style={{
                  color: 'var(--text-accent)',
                  background: 'color-mix(in srgb, var(--text-accent) 12%, transparent)',
                }}
                >
                  播放器歌词与此候选不一致，舞台目前是错的；点保存后会同步
                </p>
              ) : null}
              {picked ? (
                <p className="mt-3 truncate text-center text-[11px] opacity-45">
                  {sourceLabel} · 匹配 {picked.matchScore}%
                  {autoUseBest && picked.matchScore < AUTO_PICK_MIN_SCORE ? ' · 低于自动选用阈值' : ''}
                </p>
              ) : autoUseBest ? (
                <p className="mt-3 text-center text-[11px] opacity-45">
                  已开自动最佳歌词，低于 {AUTO_PICK_MIN_SCORE}% 不会默认勾选
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-5 py-3" style={{ borderColor: isDaylight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-2xl px-4 py-2 text-sm transition ${isDaylight ? 'hover:bg-black/5' : 'hover:bg-white/8'}`}
          >
            取消
          </button>
          <button
            type="button"
            disabled={!picked || saving}
            onClick={() => void handleSave()}
            className="rounded-2xl px-5 py-2 text-sm font-medium text-white transition disabled:opacity-45"
            style={{ backgroundColor: 'var(--text-accent)' }}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LyricMatchModal;
