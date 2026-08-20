import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { chromeButtonStyle } from '../lib/controlGlass';
import { useControlAppearanceStore } from '../store/controlAppearanceStore';

const HOVER_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 26,
};

type GlassChromeButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  active?: boolean;
  /** sm: 顶栏小圆钮；md: 底栏侧钮；pill: 带文字的返回等 */
  size?: 'sm' | 'md' | 'pill';
  children: React.ReactNode;
};

/**
 * 与播放控件同一套液态玻璃铬按钮，不透明度/模糊/悬停放大跟设置走。
 */
const GlassChromeButton: React.FC<GlassChromeButtonProps> = ({
  active = false,
  size = 'md',
  className = '',
  style,
  children,
  type = 'button',
  ...rest
}) => {
  const opacity = useControlAppearanceStore((state) => state.opacity);
  const blur = useControlAppearanceStore((state) => state.blur);
  const hoverBoost = useControlAppearanceStore((state) => state.hoverBoost);
  const hoverScale = hoverBoost <= 0 ? 1 : 1 + (hoverBoost / 100) * (size === 'sm' || size === 'pill' ? 1.8 : 2.5);

  const sizeClass = size === 'pill'
    ? 'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-medium'
    : size === 'sm'
      ? 'inline-flex items-center justify-center rounded-full p-2'
      : 'inline-flex h-12 w-12 items-center justify-center rounded-full';

  return (
    <motion.button
      type={type}
      className={`outline-none ring-0 transition-[box-shadow,background-color] ${sizeClass} ${className}`}
      style={{ ...chromeButtonStyle(opacity, blur, active), ...style }}
      initial={false}
      whileHover={{ scale: hoverScale }}
      whileTap={{ scale: Math.max(0.92, hoverScale - 0.1) }}
      transition={HOVER_SPRING}
      {...rest}
    >
      {children}
    </motion.button>
  );
};

export default GlassChromeButton;
