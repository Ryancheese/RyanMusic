import React from 'react';
import { Loader2, RefreshCw, X } from 'lucide-react';
import type { ThemeTokens } from '../types';
import type { AppUpdateInfo } from '../lib/update';
import { canInstallAppUpdate } from '../lib/update';

interface UpdateModalProps {
  open: boolean;
  isDaylight: boolean;
  theme: ThemeTokens;
  info: AppUpdateInfo | null;
  busy: boolean;
  onClose: () => void;
  onInstall: () => void;
}

const UpdateModal: React.FC<UpdateModalProps> = ({
  open,
  isDaylight,
  theme,
  info,
  busy,
  onClose,
  onInstall,
}) => {
  if (!open) return null;
  const panel = isDaylight ? 'bg-white/90 text-black' : 'bg-zinc-900/95 text-white';
  const nativeInstall = canInstallAppUpdate();

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="关闭" />
      <div className={`relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 p-5 shadow-2xl ${panel}`} style={{ color: theme.primaryColor }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">检查更新</h2>
          <button type="button" className="rounded-full p-1.5 opacity-60 hover:opacity-100" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {busy && !info ? (
          <p className="flex items-center gap-2 text-sm opacity-70">
            <Loader2 className="animate-spin" size={16} />
            正在查询 GitHub Releases…
          </p>
        ) : info?.error ? (
          <p className="text-sm opacity-70">{info.error}</p>
        ) : info?.hasUpdate ? (
          <div className="space-y-3 text-sm">
            <p>
              发现新版本 <strong>{info.latest}</strong>
              {info.current ? `（当前 ${info.current}）` : ''}
            </p>
            {info.notes ? (
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-2xl bg-white/5 p-3 text-xs opacity-70">
                {info.notes.slice(0, 800)}
              </pre>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={onInstall}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm disabled:opacity-50"
            >
              {busy ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
              {nativeInstall ? (busy ? '正在下载安装…' : '下载并替换应用') : '打开下载页'}
            </button>
            <p className="text-[11px] opacity-50">
              {nativeInstall
                ? '会下载 GitHub Release 里的 macOS 安装包，退出后自动替换并重新打开。'
                : '浏览器打开 GitHub Releases 后手动下载对应平台安装包。'}
            </p>
          </div>
        ) : (
          <p className="text-sm opacity-70">
            当前已是最新版本{info?.current ? `（${info.current}）` : ''}。
          </p>
        )}
      </div>
    </div>
  );
};

export default UpdateModal;
