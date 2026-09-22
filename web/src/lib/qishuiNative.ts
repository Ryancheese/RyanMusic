import { isMacosApp } from './media';

type BridgePayload = Record<string, unknown>;

type Pending = {
  resolve: (value: BridgePayload) => void;
  reject: (error: Error) => void;
};

const pending = new Map<string, Pending>();
let wired = false;
let seq = 0;

function handler() {
  return window.webkit?.messageHandlers?.ryanQishui;
}

export function canUseQishuiNativeQr() {
  return isMacosApp() && Boolean(handler());
}

function ensureWired() {
  if (wired) return;
  wired = true;
  window.__ryanQishuiReply = (payload) => {
    const id = String(payload.requestId || payload.id || '');
    const job = pending.get(id);
    if (!job) return;
    pending.delete(id);
    if (payload.ok === false) {
      job.reject(new Error(String(payload.error || '汽水登录失败')));
      return;
    }
    job.resolve(payload);
  };
}

function call(action: string, params: BridgePayload = {}, timeoutMs = 20_000): Promise<BridgePayload> {
  ensureWired();
  const bridge = handler();
  if (!bridge) {
    return Promise.reject(new Error('当前不是 Mac 桌面版'));
  }
  const id = `qs-${Date.now().toString(36)}-${++seq}`;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(id);
      reject(new Error('汽水登录响应超时'));
    }, timeoutMs);
    pending.set(id, {
      resolve: (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      reject: (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    });
    bridge.postMessage({ requestId: id, action, ...params });
  });
}

export async function qishuiNativeQrKey(): Promise<{ key: string; qrurl: string }> {
  const data = await call('qrKey', {}, 20_000);
  const key = String(data.key || '');
  const qrurl = String(data.qrurl || '');
  if (!key || !qrurl) throw new Error('无法获取二维码');
  return { key, qrurl };
}

export async function qishuiNativeLogout(): Promise<void> {
  if (!canUseQishuiNativeQr()) return;
  await call('logout', {}, 8_000).catch(() => undefined);
}

export async function qishuiNativeQrCheck(key: string): Promise<{
  status: number;
  message?: string;
  cookie?: string;
  loggedIn?: boolean;
}> {
  const data = await call('qrCheck', { key }, 15_000);
  return {
    status: Number(data.status) || 801,
    message: data.message ? String(data.message) : undefined,
    cookie: data.cookie ? String(data.cookie) : undefined,
    loggedIn: Boolean(data.loggedIn),
  };
}
