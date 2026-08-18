import React from 'react';

interface VisualizerWaitingProps {
  size?: number;
  coverUrl?: string | null;
}

/** 歌词未就绪：封面翻转等待，比三点更干净 */
const VisualizerWaiting: React.FC<VisualizerWaitingProps> = ({ size = 96, coverUrl }) => {
  const dim = Math.max(64, size);
  return (
    <div className="pointer-events-none flex flex-col items-center justify-center gap-3" aria-hidden>
      <div className="ryan-waiting-flip-scene" style={{ width: dim, height: dim }}>
        <div className="ryan-waiting-flip-card">
          <div className="ryan-waiting-flip-face ryan-waiting-flip-front">
            <div className="ryan-cover-shimmer h-full w-full rounded-2xl" />
          </div>
          <div className="ryan-waiting-flip-face ryan-waiting-flip-back rounded-2xl overflow-hidden">
            {coverUrl ? (
              <img src={coverUrl} alt="" className="h-full w-full object-cover" draggable={false} />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{
                  background:
                    'linear-gradient(145deg, color-mix(in srgb, var(--text-accent) 28%, var(--bg-color)), color-mix(in srgb, var(--bg-color) 85%, #000))',
                }}
              >
                <span className="text-xs opacity-50">歌词加载中</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="text-[11px] tracking-wide opacity-45">正在翻开歌词…</p>
    </div>
  );
};

export default VisualizerWaiting;
