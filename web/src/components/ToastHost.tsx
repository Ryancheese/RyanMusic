import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CircleAlert, Info } from 'lucide-react';
import { useToastStore, type AppToastKind } from '../store/toastStore';

const AUTO_DISMISS_MS = 2600;

const ICONS: Record<AppToastKind, React.ReactNode> = {
  success: <Check size={15} strokeWidth={2.6} />,
  error: <CircleAlert size={15} strokeWidth={2.2} />,
  info: <Info size={15} strokeWidth={2.2} />,
};

const ToastHost: React.FC = () => {
  const toasts = useToastStore((state) => state.toasts);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[120] flex flex-col items-center gap-2 px-4"
      style={{ bottom: 'calc(var(--player-dock-safe) + 0.75rem)' }}
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const ToastCard: React.FC<{
  toast: { id: string; kind: AppToastKind; title: string; detail?: string };
}> = ({ toast }) => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      useToastStore.getState().dismissToast(toast.id);
    }, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [toast.id]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.94, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: 10, scale: 0.96, filter: 'blur(6px)' }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto flex max-w-[min(92vw,22rem)] items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 shadow-2xl backdrop-blur-xl"
      style={{
        color: 'var(--text-primary)',
        background: 'color-mix(in srgb, var(--bg-color) 78%, transparent)',
        borderColor: 'color-mix(in srgb, var(--text-primary) 12%, transparent)',
        boxShadow: '0 18px 40px color-mix(in srgb, var(--text-primary) 12%, transparent)',
      }}
      role="status"
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)' }}
      >
        {ICONS[toast.kind]}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium leading-tight">{toast.title}</p>
        {toast.detail ? (
          <p className="mt-0.5 truncate text-[11px] opacity-50">{toast.detail}</p>
        ) : null}
      </div>
    </motion.div>
  );
};

export default ToastHost;
