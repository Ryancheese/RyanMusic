import React, { useEffect, useRef } from 'react';
import { Check, Pipette, X } from 'lucide-react';
import { contrastText } from '../lib/color';
import { ACCENT_PRESETS, useThemeAccentStore } from '../store/themeStore';

interface ThemeAccentPickerProps {
  open: boolean;
  isDaylight: boolean;
  onClose: () => void;
}

const ThemeAccentPicker: React.FC<ThemeAccentPickerProps> = ({ open, isDaylight, onClose }) => {
  const presetId = useThemeAccentStore((state) => state.presetId);
  const customColor = useThemeAccentStore((state) => state.customColor);
  const setPreset = useThemeAccentStore((state) => state.setPreset);
  const setCustomColor = useThemeAccentStore((state) => state.setCustomColor);
  const uiTint = useThemeAccentStore((state) => state.uiTint);
  const setUiTint = useThemeAccentStore((state) => state.setUiTint);
  const resolveAccent = useThemeAccentStore((state) => state.resolveAccent);
  const panelRef = useRef<HTMLDivElement>(null);
  const active = resolveAccent(isDaylight);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onPointer = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const panel = isDaylight ? 'bg-white/95 text-black' : 'bg-zinc-900/95 text-white';

  return (
    <div className="fixed inset-0 z-[75] flex items-start justify-end p-4 pt-20 md:pt-24 md:pr-8">
      <div
        ref={panelRef}
        className={`w-full max-w-xs overflow-hidden rounded-3xl border border-white/10 p-4 shadow-2xl backdrop-blur-xl ${panel}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">主题色</div>
            <div className="text-[11px] opacity-50">预设或自定义，立即生效</div>
          </div>
          <button type="button" className="rounded-full p-1.5 opacity-60 hover:opacity-100" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          {ACCENT_PRESETS.map((preset) => {
            const swatch = preset.color || (isDaylight ? '#ea580c' : '#f4f4f5');
            const selected = presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                title={preset.label}
                onClick={() => setPreset(preset.id)}
                className="group flex flex-col items-center gap-1.5"
              >
                <span
                  className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-transform ${
                    selected ? 'scale-110' : 'hover:scale-105'
                  }`}
                  style={{
                    background: swatch,
                    color: contrastText(swatch),
                    boxShadow: selected
                      ? `0 0 0 2px ${isDaylight ? '#fff' : '#18181b'}, 0 0 0 4px ${active}`
                      : undefined,
                  }}
                >
                  {selected ? <Check size={14} className="drop-shadow" /> : null}
                </span>
                <span className="text-[10px] opacity-55">{preset.label}</span>
              </button>
            );
          })}
        </div>

        <div className={`mt-4 rounded-2xl px-3 py-2.5 ${isDaylight ? 'bg-black/5' : 'bg-white/8'}`}>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="text-xs font-medium">控件着色</div>
            <div className="text-[11px] opacity-50">{uiTint}%</div>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={uiTint}
            onChange={(event) => setUiTint(Number(event.target.value))}
            className="w-full accent-[var(--text-accent)]"
          />
          <div className="mt-1 flex justify-between text-[10px] opacity-40">
            <span>弱</span>
            <span>主题色影响按钮、进度条的幅度</span>
            <span>强</span>
          </div>
        </div>

        <label className={`mt-3 flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 ${isDaylight ? 'bg-black/5' : 'bg-white/8'}`}>
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: customColor }}
          >
            <Pipette size={14} className="drop-shadow" style={{ color: contrastText(customColor) }} />
          </span>
          <span className="min-w-0 flex-1">
            <div className="text-xs font-medium">自定义</div>
            <div className="truncate font-mono text-[11px] opacity-50">{customColor}</div>
          </span>
          <input
            type="color"
            value={customColor}
            onChange={(event) => setCustomColor(event.target.value)}
            className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
          />
        </label>
      </div>
    </div>
  );
};

export default ThemeAccentPicker;
