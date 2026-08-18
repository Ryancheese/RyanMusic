import React from 'react';
import { Sparkles, X } from 'lucide-react';
import type { ThemeTokens } from '../types';

interface WhatsNewModalProps {
  open: boolean;
  isDaylight: boolean;
  theme: ThemeTokens;
  version: string;
  notes: string;
  onClose: () => void;
}

const WhatsNewModal: React.FC<WhatsNewModalProps> = ({
  open,
  isDaylight,
  theme,
  version,
  notes,
  onClose,
}) => {
  if (!open) return null;
  const panel = isDaylight ? 'bg-white/92 text-black' : 'bg-zinc-900/95 text-white';

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="关闭" />
      <div
        className={`relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 p-5 shadow-2xl ${panel}`}
        style={{ color: theme.primaryColor }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 text-[11px] tracking-wide opacity-55">
              <Sparkles size={12} />
              更新内容
            </div>
            <h2 className="text-base font-semibold">
              已更新到 {version}
            </h2>
          </div>
          <button type="button" className="rounded-full p-1.5 opacity-60 hover:opacity-100" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <pre className="max-h-[min(50vh,22rem)] overflow-auto whitespace-pre-wrap rounded-2xl bg-white/5 p-3 text-xs leading-relaxed opacity-80">
          {notes}
        </pre>
        <button
          type="button"
          onClick={onClose}
          className="btn-accent mt-4 w-full rounded-full px-4 py-2.5 text-sm font-medium"
        >
          知道了
        </button>
      </div>
    </div>
  );
};

export default WhatsNewModal;
