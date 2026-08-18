import { isMacosApp, isWindowsApp } from './media';
import { APP_VERSION, compareSemver } from '../whatsNew';

const RELEASES_URL = 'https://github.com/Ryancheese/RyanMusic/releases/latest';
const GITHUB_LATEST = 'https://api.github.com/repos/Ryancheese/RyanMusic/releases/latest';

export interface AppUpdateInfo {
  ok: boolean;
  hasUpdate: boolean;
  current?: string;
  latest?: string;
  notes?: string;
  url?: string;
  installing?: boolean;
  progress?: number;
  stage?: string;
  error?: string;
}

export interface AppUpdateProgress {
  percent?: number;
  received?: number;
  total?: number;
  stage?: string;
}

type UpdateBridge = {
  postMessage: (payload: { action: 'check' | 'install' }) => void;
};

function nativeBridge(): UpdateBridge | null {
  return window.webkit?.messageHandlers?.ryanUpdate ?? null;
}

function waitNative(timeoutMs: number): Promise<AppUpdateInfo> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('检查更新超时'));
    }, timeoutMs);
    window.__ryanUpdateResolve = (data) => {
      window.clearTimeout(timer);
      resolve(data);
    };
  });
}

export async function checkAppUpdate(): Promise<AppUpdateInfo> {
  const bridge = nativeBridge();
  if (bridge) {
    const pending = waitNative(20_000);
    bridge.postMessage({ action: 'check' });
    return pending;
  }

  try {
    const res = await fetch(GITHUB_LATEST, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error('无法读取 GitHub Releases');
    const json = await res.json() as { tag_name?: string; body?: string; html_url?: string };
    const latest = String(json.tag_name || '').replace(/^v/i, '');
    const current = APP_VERSION;
    const hasUpdate = Boolean(latest) && compareSemver(current, latest) < 0;
    return {
      ok: true,
      hasUpdate,
      current,
      latest,
      notes: String(json.body || ''),
      url: json.html_url || RELEASES_URL,
    };
  } catch (error) {
    return {
      ok: false,
      hasUpdate: false,
      current: APP_VERSION,
      url: RELEASES_URL,
      error: error instanceof Error ? error.message : '检查更新失败',
    };
  }
}

export async function installAppUpdate(
  onProgress?: (progress: AppUpdateProgress) => void,
): Promise<AppUpdateInfo> {
  const bridge = nativeBridge();
  if (!bridge) {
    window.open(RELEASES_URL, '_blank', 'noopener');
    return { ok: true, hasUpdate: true, url: RELEASES_URL };
  }

  window.__ryanUpdateProgress = (payload) => {
    onProgress?.(payload);
  };

  try {
    const pending = waitNative(10 * 60_000);
    bridge.postMessage({ action: 'install' });
    return await pending;
  } finally {
    delete window.__ryanUpdateProgress;
  }
}

export function canInstallAppUpdate() {
  return Boolean(nativeBridge()) && (isMacosApp() || isWindowsApp() || Boolean(window.chrome?.webview));
}
