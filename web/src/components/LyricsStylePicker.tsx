import React from 'react';
import { Palette } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { VISUALIZER_REGISTRY, getVisualizerModeLabel } from './visualizer/registry';
import type { VisualizerMode } from '../types';
import { useIsMobile } from '../lib/media';

interface LyricsStylePickerProps {
  open: boolean;
  mode: VisualizerMode;
  isDaylight: boolean;
  onClose: () => void;
  onChange: (mode: VisualizerMode) => void;
}

const LyricsStylePicker: React.FC<LyricsStylePickerProps> = ({
  open,
  mode,
  isDaylight,
  onClose,
  onChange,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  if (!open) return null;
  const panel = isDaylight ? 'bg-white/90 border-black/10 text-stone-900' : 'bg-black/70 border-white/10 text-zinc-100';
  const idle = isDaylight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/8 hover:bg-white/14';

  return (
    <div
      className={`absolute inset-0 z-50 flex ${isMobile ? 'items-end' : 'justify-end'}`}
      onClick={onClose}
    >
      <aside
        className={`flex flex-col overflow-hidden border shadow-2xl backdrop-blur-3xl ${panel} ${
          isMobile
            ? 'max-h-[min(70dvh,100%)] w-full rounded-t-3xl'
            : 'm-4 h-[calc(100%-2rem)] w-[min(380px,100vw-2rem)] rounded-3xl'
        }`}
        style={isMobile ? { paddingBottom: 'var(--safe-bottom)' } : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        {isMobile && (
          <div className="flex justify-center pt-2">
            <span className={`h-1 w-10 rounded-full ${isDaylight ? 'bg-black/20' : 'bg-white/25'}`} />
          </div>
        )}
        <div className="flex items-center gap-2 px-5 py-4">
          <Palette size={16} />
          <div className="text-sm font-semibold">歌词样式</div>
        </div>
        <div className="px-5 pb-2 text-xs opacity-50">歌词动画</div>
        <div className="grid grid-cols-2 gap-2 overflow-y-auto px-5 pb-5">
          {VISUALIZER_REGISTRY.map((entry) => {
            const active = entry.mode === mode;
            return (
              <button
                key={entry.mode}
                type="button"
                onClick={() => onChange(entry.mode)}
                className={`rounded-2xl px-3 py-3 text-left text-sm font-medium transition-colors ${
                  active ? 'ring-2 ring-sky-400 bg-sky-400/15' : idle
                }`}
              >
                {getVisualizerModeLabel(entry.mode, t)}
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
};

export default LyricsStylePicker;
