import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSizedCoverUrl } from '../utils/coverUrl';
import { coverImageUrl } from '../api';

interface CoverArtProps {
  src?: string;
  alt?: string;
  className?: string;
  placeholderClassName?: string;
  lazy?: boolean;
  size?: number;
  /** 首次加载成功时播放翻转动画；已见过的封面直接展示 */
  flipOnLoad?: boolean;
}

/** 会话内已成功翻开过的封面，避免滚动复用时反复翻转 */
const revealedCoverKeys = new Set<string>();

function DefaultCover({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex h-full w-full items-center justify-center ${className}`}
      style={{
        background: `
          radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--text-accent) 38%, transparent), transparent 55%),
          linear-gradient(145deg, color-mix(in srgb, var(--text-accent) 22%, var(--bg-color)), color-mix(in srgb, var(--bg-color) 88%, #000))
        `,
      }}
    >
      <svg viewBox="0 0 80 80" className="h-[42%] w-[42%] opacity-70" aria-hidden>
        <circle cx="40" cy="40" r="28" fill="none" stroke="var(--text-primary)" strokeWidth="2.2" opacity="0.35" />
        <circle cx="40" cy="40" r="8" fill="var(--text-accent)" opacity="0.85" />
        <path
          d="M48 22v26a8 8 0 1 1-3.5-6.6V28.5L48 22z"
          fill="var(--text-primary)"
          opacity="0.55"
        />
      </svg>
    </div>
  );
}

function CoverShimmer() {
  return <div className="ryan-cover-shimmer h-full w-full" aria-hidden />;
}

const CoverArt: React.FC<CoverArtProps> = ({
  src,
  alt = '',
  className = 'h-full w-full object-cover',
  placeholderClassName = '',
  lazy = false,
  size = 400,
  flipOnLoad = true,
}) => {
  const candidates = useMemo(() => {
    const raw = src?.trim() || '';
    if (!raw) return [];
    const sized = getSizedCoverUrl(raw, size) || raw;
    const proxied = coverImageUrl(raw, size);
    return [...new Set([proxied, sized, raw].filter(Boolean))];
  }, [size, src]);

  const cacheKey = candidates[0] || '';
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [instant, setInstant] = useState(() => Boolean(cacheKey && revealedCoverKeys.has(cacheKey)));
  const imgRef = useRef<HTMLImageElement>(null);
  const url = candidates[index] || '';

  useEffect(() => {
    const seen = Boolean(candidates[0] && revealedCoverKeys.has(candidates[0]));
    setIndex(0);
    setFailed(false);
    setLoaded(false);
    setFlipped(false);
    setInstant(seen);
  }, [src, candidates]);

  const reveal = useCallback(() => {
    setLoaded((already) => {
      if (already) return true;
      if (cacheKey) revealedCoverKeys.add(cacheKey);
      if (!flipOnLoad || instant) {
        setFlipped(true);
      } else {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setFlipped(true));
        });
      }
      return true;
    });
  }, [cacheKey, flipOnLoad, instant]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img || !url || loaded || failed) return;
    if (img.complete && img.naturalWidth > 0) reveal();
  }, [url, loaded, failed, reveal]);

  if (!candidates.length || failed) {
    return <DefaultCover className={placeholderClassName} />;
  }

  const image = (
    <img
      ref={imgRef}
      src={url}
      alt={alt}
      draggable={false}
      loading={lazy ? 'lazy' : 'eager'}
      decoding="async"
      className={className}
      onLoad={reveal}
      onError={() => {
        if (index + 1 < candidates.length) {
          setIndex((prev) => prev + 1);
          setLoaded(false);
          setFlipped(false);
          return;
        }
        setFailed(true);
      }}
    />
  );

  if (!flipOnLoad) {
    return (
      <div className="relative h-full w-full overflow-hidden">
        {!loaded ? (
          <div className="absolute inset-0 z-[1]">
            <CoverShimmer />
          </div>
        ) : null}
        <div className={`h-full w-full transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}>
          {image}
        </div>
      </div>
    );
  }

  return (
    <div className="ryan-cover-flip-scene relative h-full w-full">
      <div
        className={[
          'ryan-cover-flip-card',
          flipped ? 'is-flipped' : '',
          instant ? 'is-instant' : '',
        ].filter(Boolean).join(' ')}
      >
        <div className="ryan-cover-flip-face ryan-cover-flip-front">
          <CoverShimmer />
        </div>
        <div className="ryan-cover-flip-face ryan-cover-flip-back">
          {image}
        </div>
      </div>
    </div>
  );
};

export default CoverArt;
