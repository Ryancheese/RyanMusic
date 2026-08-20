import type React from 'react';

/** 与底栏播放控件同一套液态玻璃填充 */
export const glassFill = (opacity: number, extra = 0) => (
  `color-mix(in srgb, var(--text-accent) var(--accent-ui-soft, 18%), color-mix(in srgb, var(--bg-color) ${Math.min(90, Math.max(12, opacity + extra))}%, transparent))`
);

/** 圆形/胶囊铬按钮样式（受设置里的不透明度、模糊度控制） */
const themeChromeTransition =
  'background-color 0.5s cubic-bezier(0.22, 1, 0.36, 1), color 0.5s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.5s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.5s cubic-bezier(0.22, 1, 0.36, 1)';

export const chromeButtonStyle = (
  opacity: number,
  blur: number,
  active = false,
): React.CSSProperties => ({
  backgroundColor: glassFill(opacity, active ? 8 : 0),
  color: 'color-mix(in srgb, var(--text-accent) var(--accent-ui-mix, 45%), var(--text-primary))',
  border: '1px solid color-mix(in srgb, var(--text-accent) var(--accent-ui-border, 25%), transparent)',
  boxShadow: '0 10px 28px rgba(0, 0, 0, 0.18)',
  backdropFilter: `blur(${blur}px)`,
  WebkitBackdropFilter: `blur(${blur}px)`,
  transition: themeChromeTransition,
});

/** 底栏主胶囊略加重阴影 */
export const chromeCapsuleStyle = (
  opacity: number,
  blur: number,
  expanded = false,
): React.CSSProperties => ({
  backgroundColor: glassFill(opacity, expanded ? 4 : -6),
  boxShadow: '0 16px 36px rgba(0, 0, 0, 0.28)',
  backdropFilter: `blur(${blur}px)`,
  WebkitBackdropFilter: `blur(${blur}px)`,
  isolation: 'isolate',
  border: '1px solid color-mix(in srgb, var(--text-accent) var(--accent-ui-border, 25%), transparent)',
  transition: themeChromeTransition,
});
