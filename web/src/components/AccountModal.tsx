import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, LogOut, RefreshCw, X } from 'lucide-react';
import type { ThemeTokens } from '../types';
import { coverImageUrl, postAction, type AccountStatus } from '../api';
import { useCloudStore } from '../store/cloudStore';
import RyanLoader from './RyanLoader';
import {
  ACCOUNT_PROVIDERS,
  accountOf,
  capsuleDisplayName,
  membershipHeadline,
  membershipHint,
  platformStatusLine,
  providerMeta,
  type AccountProviderId,
} from '../lib/accountProviders';

interface AccountModalProps {
  open: boolean;
  isDaylight: boolean;
  theme: ThemeTokens;
  netease: AccountStatus | null;
  qq: AccountStatus | null;
  kugou?: AccountStatus | null;
  /** 打开时优先选中的平台 */
  initialProvider?: AccountProviderId;
  onClose: () => void;
  onChanged: () => void;
  onLoggedIn?: (provider: AccountProviderId) => void;
  onSync?: (provider: AccountProviderId) => Promise<void> | void;
  syncing?: boolean;
  syncMessage?: string;
}

const AccountModal: React.FC<AccountModalProps> = ({
  open,
  isDaylight,
  theme,
  netease,
  qq,
  kugou = null,
  initialProvider = 'netease',
  onClose,
  onChanged,
  onLoggedIn,
  onSync,
  syncing = false,
  syncMessage = '',
}) => {
  const [tab, setTab] = useState<AccountProviderId>(initialProvider);
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [qr, setQr] = useState('');
  const [cookie, setCookie] = useState('');
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const panel = isDaylight ? 'bg-white/90 text-black' : 'bg-zinc-900/95 text-white';
  const idle = isDaylight ? 'bg-black/6' : 'bg-white/8';
  const soft = isDaylight ? 'bg-black/4' : 'bg-white/6';

  useEffect(() => {
    if (!open) {
      setMenuOpen(false);
      return;
    }
    setTab(initialProvider);
    setCookie('');
    setStatus('');
  }, [open, initialProvider]);

  useEffect(() => {
    if (!open) return;
    const current = accountOf(tab, netease, qq, kugou);
    if (current?.loggedIn) {
      setQr('');
      return;
    }
    let stop = false;
    let timer = 0;
    const start = async () => {
      setBusy(true);
      setStatus('正在生成二维码…');
      const keyAction = tab === 'netease' ? 'netease_qr_key' : tab === 'kugou' ? 'kugou_qr_key' : 'qq_qr_key';
      const checkAction = tab === 'netease' ? 'netease_qr_check' : tab === 'kugou' ? 'kugou_qr_check' : 'qq_qr_check';
      const res = await postAction<Record<string, string>>(keyAction);
      setBusy(false);
      if (stop) return;
      if (res.code !== 200 || !res.data) {
        setStatus(res.error || '无法生成二维码，请改用 Cookie');
        return;
      }
      if (tab === 'netease') {
        const qrurl = res.data.qrurl || `https://music.163.com/login?codekey=${encodeURIComponent(res.data.key)}`;
        setQr(`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrurl)}`);
        setStatus('请使用网易云 App 扫码');
      } else if (tab === 'kugou') {
        const qrurl = res.data.qrurl || '';
        setQr(res.data.qrimg || (qrurl
          ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrurl)}`
          : ''));
        setStatus('请使用酷狗 App 扫码');
      } else {
        setQr(res.data.qrimg || '');
        setStatus('请使用 QQ / 微信扫码');
      }
      const key = res.data.key || '';
      timer = window.setInterval(async () => {
        const check = await postAction<Record<string, unknown>>(checkAction, key ? { key } : {});
        if (stop) return;
        const data = (check.data || {}) as Record<string, unknown>;
        const st = Number(data.status);
        if (tab === 'netease') {
          if (st === 801) setStatus('等待扫码…');
          else if (st === 802) setStatus('已扫码，请在手机上确认');
          else if (st === 800) {
            setStatus('二维码已过期，请关闭后重开');
            window.clearInterval(timer);
          } else if (st === 803 && data.loggedIn) {
            setStatus('登录成功，正在同步歌单…');
            window.clearInterval(timer);
            onChanged();
            onLoggedIn?.(tab);
          } else if (check.error) {
            setStatus(check.error);
          }
        } else if (tab === 'kugou') {
          if (st === 1) setStatus(String(data.message || '等待扫码…'));
          else if (st === 2) setStatus(String(data.message || '已扫码，请在手机上确认'));
          else if (st === 0) {
            setStatus(String(data.message || '二维码已过期，请关闭后重开'));
            window.clearInterval(timer);
          } else if (st === 4 && data.loggedIn) {
            setStatus('登录成功');
            window.clearInterval(timer);
            onChanged();
            onLoggedIn?.(tab);
          } else if (check.code !== 200 && check.error) {
            setStatus(check.error);
            window.clearInterval(timer);
          }
        } else if (st === 66) {
          setStatus(String(data.message || '等待扫码…'));
        } else if (st === 67) {
          setStatus(String(data.message || '已扫码，请在手机上确认'));
        } else if (st === 65) {
          setStatus(String(data.message || '二维码已过期，请关闭后重开'));
          window.clearInterval(timer);
        } else if (st === 0 && data.loggedIn) {
          setStatus('登录成功，正在同步歌单…');
          window.clearInterval(timer);
          onChanged();
          onLoggedIn?.(tab);
        } else if (check.code !== 200 && check.error) {
          setStatus(check.error);
          window.clearInterval(timer);
        }
      }, 2000);
    };
    void start();
    return () => {
      stop = true;
      if (timer) window.clearInterval(timer);
    };
  }, [open, tab, netease?.loggedIn, qq?.loggedIn, kugou?.loggedIn, onChanged, onLoggedIn]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  if (!open) return null;

  const current = accountOf(tab, netease, qq, kugou);
  const loggedIn = Boolean(current?.loggedIn);
  const activeMeta = providerMeta(tab);
  const capsuleAvatar = loggedIn && current?.avatar
    ? (coverImageUrl(current.avatar, 96) || current.avatar)
    : '';

  const saveCookie = async () => {
    setBusy(true);
    const action = tab === 'netease' ? 'netease_cookie_save' : tab === 'kugou' ? 'kugou_cookie_save' : 'qq_cookie_save';
    const res = await postAction(action, { cookie: cookie.trim() });
    setBusy(false);
    if (res.code !== 200) {
      setStatus(res.error || 'Cookie 无效');
      return;
    }
    setStatus(tab === 'kugou' ? '登录成功' : '登录成功，正在同步歌单…');
    setCookie('');
    onChanged();
    onLoggedIn?.(tab);
  };

  const logout = async (provider: AccountProviderId) => {
    const meta = providerMeta(provider);
    if (provider === 'netease' || provider === 'qq') {
      useCloudStore.getState().clearProvider(provider);
    }
    onChanged();
    await postAction(meta.logoutAction);
    onChanged();
  };

  const selectProvider = (provider: AccountProviderId) => {
    setTab(provider);
    setMenuOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="关闭" />
      <div
        className={`app-theme-surface relative z-10 w-full max-w-md overflow-visible rounded-3xl border border-white/10 p-5 shadow-2xl transition-[background-color,color,border-color] duration-500 ${panel}`}
        style={{ color: theme.primaryColor }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">账号登录</h2>
          <button type="button" className="rounded-full p-1.5 opacity-60 hover:opacity-100" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="relative mb-4" ref={menuRef}>
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-haspopup="listbox"
            onClick={() => setMenuOpen((openMenu) => !openMenu)}
            className={`flex h-12 w-full min-w-0 items-center gap-3 rounded-full px-3 text-left transition-[background-color,box-shadow,color] duration-500 ${idle}`}
            style={{
              boxShadow: menuOpen
                ? (isDaylight ? '0 10px 28px rgba(0,0,0,0.12)' : '0 12px 32px rgba(0,0,0,0.45)')
                : undefined,
            }}
          >
            {capsuleAvatar ? (
              <img
                src={capsuleAvatar}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                  const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.hidden = false;
                }}
              />
            ) : null}
            <span
              hidden={Boolean(capsuleAvatar)}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${activeMeta.markClass}`}
            >
              {activeMeta.mark}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-tight">
                {loggedIn ? capsuleDisplayName(current, activeMeta.shortLabel) : activeMeta.label}
              </span>
              <span className="mt-0.5 block truncate text-[11px] leading-tight opacity-55">
                {loggedIn ? activeMeta.label : platformStatusLine(current)}
              </span>
            </span>
            <motion.span
              animate={{ rotate: menuOpen ? 180 : 0 }}
              transition={{ duration: 0.22 }}
              className="shrink-0 opacity-50"
            >
              <ChevronDown size={16} />
            </motion.span>
          </button>

          <AnimatePresence>
            {menuOpen ? (
              <motion.div
                role="listbox"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className={`absolute inset-x-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-white/10 p-1.5 shadow-2xl ${
                  isDaylight ? 'bg-white text-black' : 'bg-zinc-900 text-white'
                }`}
              >
                {ACCOUNT_PROVIDERS.map((provider) => {
                  const account = accountOf(provider.id, netease, qq, kugou);
                  const active = tab === provider.id;
                  const avatar = account?.loggedIn && account.avatar
                    ? (coverImageUrl(account.avatar, 72) || account.avatar)
                    : '';
                  const rowName = capsuleDisplayName(account, provider.shortLabel);
                  return (
                    <div
                      key={provider.id}
                      className={`flex h-12 items-center gap-2 rounded-xl px-2 ${
                        active ? soft : (isDaylight ? 'hover:bg-black/5' : 'hover:bg-white/5')
                      }`}
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => selectProvider(provider.id)}
                        className="flex h-full min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        {avatar ? (
                          <img
                            src={avatar}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-full object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none';
                              const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
                              if (fallback) fallback.hidden = false;
                            }}
                          />
                        ) : null}
                        <span
                          hidden={Boolean(avatar)}
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${provider.markClass}`}
                        >
                          {provider.mark}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium leading-tight">{rowName}</span>
                          <span className="mt-0.5 block truncate text-[11px] leading-tight opacity-50">
                            {account?.loggedIn ? provider.label : platformStatusLine(account)}
                          </span>
                        </span>
                      </button>
                      {account?.loggedIn ? (
                        <button
                          type="button"
                          title={`退出 ${provider.label}`}
                          aria-label={`退出 ${provider.label}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            void logout(provider.id);
                          }}
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full opacity-60 transition hover:opacity-100 ${idle}`}
                        >
                          <LogOut size={14} />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {loggedIn ? (
          <div className="space-y-3 text-sm">
            <div
              className={`flex h-14 items-center gap-3 rounded-full px-3 transition-[background-color,color] duration-500 ${soft}`}
            >
              {capsuleAvatar ? (
                <img
                  src={capsuleAvatar}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                    const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.hidden = false;
                  }}
                />
              ) : null}
              <div
                hidden={Boolean(capsuleAvatar)}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs opacity-50 ${idle}`}
              >
                {(current?.nickname || '?').slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold leading-tight">{membershipHeadline(current)}</p>
                <p className="mt-0.5 text-[11px] leading-snug opacity-55">
                  {membershipHint(current)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeMeta.hasCloudLibrary ? (
                <button
                  type="button"
                  onClick={() => void onSync?.(tab)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm"
                >
                  {syncing ? <RyanLoader size={16} /> : <RefreshCw size={14} />}
                  同步歌单
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void logout(tab)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm"
              >
                <LogOut size={14} />
                退出登录
              </button>
            </div>
            {syncMessage ? <p className="text-xs opacity-60">{syncMessage}</p> : null}
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-xs leading-relaxed opacity-60">{membershipHint(null)}</p>
            <div className="flex flex-col items-center gap-2">
              {qr ? <img src={qr} alt="登录二维码" width={180} height={180} className="rounded-xl bg-white p-2" /> : (
                <div className="flex h-[180px] w-[180px] items-center justify-center rounded-xl bg-white/5">
                  {busy ? <RyanLoader size={40} label="生成二维码…" /> : '二维码'}
                </div>
              )}
              <p className="text-xs opacity-70">{status}</p>
            </div>
            <details className="rounded-2xl bg-white/5 p-3">
              <summary className="cursor-pointer text-xs opacity-70">扫码不行？改用 Cookie</summary>
              <p className="mt-2 text-[11px] opacity-50">
                {tab === 'netease'
                  ? '浏览器登录 music.163.com，复制请求头 Cookie（需含 MUSIC_U）。仅存本机。'
                  : tab === 'kugou'
                    ? '浏览器登录 kugou.com，复制请求头 Cookie（需含 userid 与 token，或 KuGoo）。仅存本机。'
                    : '浏览器登录 y.qq.com，复制请求头 Cookie（需含 uin 与 qm_keyst）。仅存本机。'}
              </p>
              <textarea
                value={cookie}
                onChange={(event) => setCookie(event.target.value)}
                rows={4}
                placeholder="粘贴 Cookie…"
                className={`mt-2 w-full rounded-xl border border-white/10 p-2 text-xs outline-none ${isDaylight ? 'bg-black/5' : 'bg-black/20'}`}
              />
              <button type="button" onClick={() => void saveCookie()} className="mt-2 rounded-full bg-white/10 px-4 py-1.5 text-xs">
                保存并登录
              </button>
            </details>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountModal;
