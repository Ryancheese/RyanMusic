import React from 'react';

interface WordByWordBadgeProps {
  className?: string;
  compact?: boolean;
}

/** 右上角「# 逐字」标注 */
const WordByWordBadge: React.FC<WordByWordBadgeProps> = ({ className = '', compact = false }) => (
  <span
    className={`pointer-events-none select-none rounded-md font-medium tracking-wide ${
      compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
    } ${className}`}
    style={{
      color: 'color-mix(in srgb, var(--text-accent) 72%, white)',
      backgroundColor: 'color-mix(in srgb, var(--text-accent) 22%, rgba(20, 16, 36, 0.55))',
      border: '1px solid color-mix(in srgb, var(--text-accent) 28%, transparent)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
    }}
  >
    # 逐字
  </span>
);

export default WordByWordBadge;
