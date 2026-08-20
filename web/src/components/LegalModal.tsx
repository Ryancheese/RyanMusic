import React, { useEffect, useRef } from 'react';
import { CircleHelp, X } from 'lucide-react';
import type { ThemeTokens } from '../types';
import { LEGAL_DOCS, LEGAL_TABS, type LegalTab } from '../legal';

interface LegalModalProps {
  open: boolean;
  tab: LegalTab;
  isDaylight: boolean;
  theme: ThemeTokens;
  onClose: () => void;
  onTabChange: (tab: LegalTab) => void;
}

const LegalModal: React.FC<LegalModalProps> = ({
  open,
  tab,
  isDaylight,
  theme,
  onClose,
  onTabChange,
}) => {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const el = bodyRef.current;
    if (el) el.scrollTop = 0;
  }, [open, tab]);

  if (!open) return null;
  const doc = LEGAL_DOCS[tab];
  const panel = isDaylight ? 'bg-white/95 text-stone-900' : 'bg-zinc-900/95 text-zinc-100';
  const muted = isDaylight ? 'bg-black/5' : 'bg-white/8';

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 md:items-center md:p-6" onClick={onClose}>
      <aside
        className={`flex max-h-[min(88dvh,760px)] w-full max-w-2xl flex-col overflow-hidden border border-white/10 shadow-2xl backdrop-blur-xl ${panel} md:rounded-3xl`}
        style={{ paddingBottom: 'var(--safe-bottom)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CircleHelp size={16} />
            {doc.title}
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        <div className={`mx-5 mb-3 flex gap-1 rounded-full p-1 ${muted}`}>
          {LEGAL_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`flex-1 rounded-full py-1.5 text-xs transition ${
                tab === item.id ? (isDaylight ? 'bg-white shadow' : 'bg-white/15') : 'opacity-55'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          key={tab}
          ref={bodyRef}
          className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 text-sm leading-relaxed"
        >
          {doc.sections.map((section, index) => (
            <section key={`${tab}-${index}`} className="mb-5">
              {section.title ? (
                <h3 className="mb-2 text-[13px] font-semibold tracking-wide" style={{ color: theme.primaryColor }}>
                  {section.title}
                </h3>
              ) : null}
              {section.paragraphs?.map((text) => (
                <p key={text} className="mb-2 opacity-80">
                  {renderRichText(text)}
                </p>
              ))}
              {section.items?.length ? (
                <ul className="list-disc space-y-1.5 pl-5 opacity-80">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
};

function renderRichText(text: string) {
  const email = text.match(/^(邮箱：)(\S+)$/);
  if (email) {
    return (
      <>
        {email[1]}
        <a href={`mailto:${email[2]}`} className="underline underline-offset-2">
          {email[2]}
        </a>
      </>
    );
  }
  return text;
}

export default LegalModal;
