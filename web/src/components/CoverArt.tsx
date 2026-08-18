import React, { useEffect, useState } from 'react';

interface CoverArtProps {
  src?: string;
  alt?: string;
  className?: string;
  placeholderClassName?: string;
}

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

const CoverArt: React.FC<CoverArtProps> = ({
  src,
  alt = '',
  className = 'h-full w-full object-cover',
  placeholderClassName = '',
}) => {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const url = src?.trim() || '';

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [url]);

  if (!url || failed) {
    return <DefaultCover className={placeholderClassName} />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {!loaded ? (
        <div className="absolute inset-0 ryan-cover-shimmer" aria-hidden />
      ) : null}
      <img
        src={url}
        alt={alt}
        draggable={false}
        loading="lazy"
        decoding="async"
        className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
};

export default CoverArt;
