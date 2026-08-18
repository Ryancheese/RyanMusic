import React, { useEffect, useState } from 'react';
import { LogOut, RefreshCw, X } from 'lucide-react';
import type { ThemeTokens } from '../types';
import { postAction, type AccountStatus } from '../api';
import { useCloudStore } from '../store/cloudStore';
import RyanLoader from './RyanLoader';

type Provider = 'netease' | 'qq';

interface AccountModalProps {
  open: boolean;
  isDaylight: boolean;
  theme: ThemeTokens;
  netease: AccountStatus | null;
  qq: AccountStatus | null;
  onClose: () => void;
  onChanged: () => void;
  onLoggedIn?: (provider: Provider) => void;
  onSync?: (provider: Provider) => Promise<void> | void;
  syncing?: boolean;
  syncMessage?: string;
}

const AccountModal: React.FC<AccountModalProps> = ({
  open,
  isDaylight,
  theme,
  netease,
  qq,
  onClose,
  onChanged,
  onLoggedIn,
  onSync,
  syncing = false,
  syncMessage = '',
}) => {
  const [tab, setTab] = useState<Provider>('netease');
  const [status, setStatus] = useState('');
  const [qr, setQr] = useState('');
  const [cookie, setCookie] = useState('');
  const [busy, setBusy] = useState(false);
  const panel = isDaylight ? 'bg-white/90 text-black' : 'bg-zinc-900/95 text-white';

  useEffect(() => {
    if (!open) return;
    setCookie('');
    setStatus('');
    const current = tab === 'netease' ? netease : qq;
    if (current?.loggedIn) {
      setQr('');
      return;
    }
    let stop = false;
    let timer = 0;
    const start = async () => {
      setBusy(true);
      setStatus('正在生成二维码…');
      const keyAction = tab === 'netease' ? 'netease_qr_key' : 'qq_qr_key';
      const checkAction = tab === 'netease' ? 'netease_qr_check' : 'qq_qr_check';
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
  }, [open, tab, netease?.loggedIn, qq?.loggedIn, onChanged]);

  if (!open) return null;
  const current = tab === 'netease' ? netease : qq;
  const loggedIn = Boolean(current?.loggedIn);

  const saveCookie = async () => {
    setBusy(true);
    const action = tab === 'netease' ? 'netease_cookie_save' : 'qq_cookie_save';
    const res = await postAction(action, { cookie: cookie.trim() });
    setBusy(false);
    if (res.code !== 200) {
      setStatus(res.error || 'Cookie 无效');
      return;
    }
    setStatus('登录成功，正在同步歌单…');
    setCookie('');
    onChanged();
    onLoggedIn?.(tab);
  };

  const logout = async () => {
    const action = tab === 'netease' ? 'netease_logout' : 'qq_logout';
    useCloudStore.getState().clearProvider(tab);
    onChanged();
    await postAction(action);
    onChanged();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4"
      style={{
        paddingTop: 'max(1rem, var(--safe-top))',
        paddingBottom: 'max(1rem, calc(var(--safe-bottom) + 0.5rem))',
      }}
    >
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="关闭" />
      <div className={`relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 p-5 shadow-2xl ${panel}`} style={{ color: theme.primaryColor }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">账号登录</h2>
          <button type="button" className="rounded-full p-1.5 opacity-60 hover:opacity-100" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className={`mb-4 flex rounded-full p-1 ${isDaylight ? 'bg-black/5' : 'bg-white/8'}`}>
          {(['netease', 'qq'] as Provider[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`flex-1 rounded-full py-1.5 text-sm ${tab === item ? (isDaylight ? 'bg-white shadow-sm' : 'bg-white text-black') : 'opacity-60'}`}
            >
              {item === 'netease' ? '网易云' : 'QQ 音乐'}
            </button>
          ))}
        </div>
        {loggedIn ? (
          <div className="space-y-3 text-sm">
            <p>
              已登录：<strong>{current?.nickname || '已登录'}</strong>
              {current?.vip ? ' · 会员' : ' · 非会员将走 RyanMusic 音源'}
            </p>
            <p className="text-xs opacity-60">
              会员曲目优先走官方播放（与 Folia 相同）。非会员或官方无地址时，自动回退 RyanMusic。
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onSync?.(tab)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm"
              >
                {syncing ? <RyanLoader size={16} /> : <RefreshCw size={14} />}
                同步歌单
              </button>
              <button type="button" onClick={() => void logout()} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm">
                <LogOut size={14} />
                退出登录
              </button>
            </div>
            {syncMessage ? <p className="text-xs opacity-60">{syncMessage}</p> : null}
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-xs opacity-60">
              登录后会员曲目走官方播放与逐字歌词；非会员仍用 RyanMusic 播放。
            </p>
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
