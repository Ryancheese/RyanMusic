import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MotionValue } from 'framer-motion';
import type { Line } from '../types';
import { findLatestActiveLineIndex } from '../lib/lyrics';
import { isInterludeLine } from '../utils/lyrics/parserCore';
import InterludeDots from './InterludeDots';

interface LyricPreviewKaraokeProps {
  lines: Line[];
  currentTime: MotionValue<number>;
  wordByWord: boolean;
  emptyHint?: string;
  /** 匹配面板：展示完整歌词列表，便于对比各候选 */
  fullList?: boolean;
}

function windowed(lines: Line[], center: number, before = 3, after = 4) {
  if (!lines.length) return [] as Array<{ line: Line; index: number; active: boolean }>;
  const mid = center >= 0 ? center : 0;
  const start = Math.max(0, mid - before);
  const end = Math.min(lines.length - 1, mid + after);
  const out: Array<{ line: Line; index: number; active: boolean }> = [];
  for (let i = start; i <= end; i += 1) {
    out.push({ line: lines[i], index: i, active: i === mid });
  }
  return out;
}

function linesSignature(lines: Line[]): string {
  if (!lines.length) return '';
  return `${lines.length}:${lines[0]?.startTime}:${lines[lines.length - 1]?.startTime}:${lines[0]?.fullText || ''}`;
}

const LyricPreviewKaraoke: React.FC<LyricPreviewKaraokeProps> = ({
  lines,
  currentTime,
  wordByWord,
  emptyHint = '暂无歌词预览',
  fullList = false,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const signature = linesSignature(lines);
  const [lineIndex, setLineIndex] = useState(() => findLatestActiveLineIndex(lines, currentTime.get()));
  const rows = useMemo(
    () => (fullList
      ? lines.map((line, index) => ({ line, index, active: index === lineIndex }))
      : windowed(lines, lineIndex)),
    [fullList, lineIndex, lines],
  );

  useEffect(() => {
    setLineIndex(findLatestActiveLineIndex(lines, currentTime.get()));
  }, [currentTime, lines, signature]);

  useEffect(() => {
    if (!fullList || lineIndex < 0) return;
    const root = rootRef.current;
    const active = root?.querySelector('[data-preview-active="true"]') as HTMLElement | null;
    active?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [fullList, lineIndex, lines.length]);

  useEffect(() => {
    let frame = 0;
    let lastIndex = -2;
    const tick = () => {
      const time = currentTime.get();
      const next = findLatestActiveLineIndex(lines, time);
      if (next !== lastIndex) {
        lastIndex = next;
        setLineIndex(next);
      }
      const root = rootRef.current;
      if (root && wordByWord) {
        const words = root.querySelectorAll<HTMLElement>('[data-lyric-word]');
        for (let i = 0; i < words.length; i += 1) {
          const el = words[i];
          const start = Number(el.dataset.start || 0);
          const lit = time >= start;
          el.style.color = lit ? 'var(--text-accent)' : '';
          el.style.opacity = lit ? '1' : '';
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [currentTime, lines, wordByWord]);

  if (!lines.length) {
    return (
      <div className="flex h-full min-h-[10rem] items-center justify-center text-sm opacity-45">
        {emptyHint}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="side-panel-lyrics hide-scrollbar h-full select-none overflow-x-hidden overflow-y-auto space-y-2.5 text-left text-[15px] leading-[1.7]">
      {rows.map(({ line, index, active }) => (
        <p
          key={`${line.startTime}-${index}`}
          data-preview-active={active ? 'true' : undefined}
          className={active ? 'font-semibold' : 'opacity-40'}
        >
          {isInterludeLine(line) ? (
            <InterludeDots
              size={active ? 5 : 4}
              gap={5}
              color="currentColor"
              activeColor="var(--text-accent)"
              activeIndex={active ? 5 : undefined}
            />
          ) : wordByWord && (line.words || []).length >= 2 ? (
            (line.words || []).map((word, wordIndex) => (
              <span
                key={`${word.startTime}-${wordIndex}`}
                data-lyric-word={active ? 'true' : undefined}
                data-start={word.startTime}
                data-end={word.endTime > word.startTime ? word.endTime : word.startTime + 0.16}
                className="opacity-55"
              >
                {word.text}
              </span>
            ))
          ) : (
            <span>{line.fullText || (line.words || []).map((word) => word.text).join('')}</span>
          )}
        </p>
      ))}
    </div>
  );
};

export default LyricPreviewKaraoke;
