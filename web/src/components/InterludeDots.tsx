import React from 'react';

interface InterludeDotsProps {
  count?: number;
  /** 0..count lit dots for timed interludes; omit for static list */
  activeIndex?: number;
  size?: number;
  gap?: number;
  className?: string;
  color?: string;
  activeColor?: string;
}

/** 间奏省略号：纯 CSS 正圆，避开 macOS 中文字体把 "." / "。" 渲成方块或椭圆 */
const InterludeDots: React.FC<InterludeDotsProps> = ({
  count = 6,
  activeIndex,
  size = 5,
  gap = 6,
  className = '',
  color = 'currentColor',
  activeColor,
}) => {
  const dots = Array.from({ length: count }, (_, index) => {
    const lit = typeof activeIndex === 'number' ? index <= activeIndex : false;
    const dim = typeof activeIndex === 'number';
    return (
      <span
        key={index}
        aria-hidden
        className="shrink-0"
        style={{
          display: 'block',
          boxSizing: 'border-box',
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          maxWidth: size,
          maxHeight: size,
          aspectRatio: '1 / 1',
          borderRadius: '50%',
          backgroundColor: lit && activeColor ? activeColor : color,
          opacity: dim ? (lit ? 1 : 0.28) : 0.55,
          // 只用等比 scale，避免被父级非等比变换拉成椭圆
          transform: lit ? 'scale(1.12)' : 'scale(1)',
          transformOrigin: 'center center',
          transition: 'opacity 160ms ease, transform 160ms ease, background-color 160ms ease',
        }}
      />
    );
  });

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{
        gap,
        lineHeight: 0,
        fontSize: 0,
        letterSpacing: 0,
        transform: 'none',
      }}
      role="img"
      aria-label="间奏"
    >
      {dots}
    </span>
  );
};

export default InterludeDots;
