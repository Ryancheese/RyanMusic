/** 当前应用版本（与 Info.plist / Windows Version / server package 保持一致） */
export const APP_VERSION = '2.0.6';

const SEEN_KEY = 'ryanmusic-whats-new-seen';

/** 本版启动后弹窗展示的更新说明 */
export const WHATS_NEW_NOTES = `• 网易云 / QQ 音乐推荐歌单、每日推荐与私人 FM
• 云音乐库分区切换：我的歌单 / 推荐
• 提供 Intel Mac 安装包（x64 DMG）`;

export function shouldShowWhatsNew(currentVersion = APP_VERSION): boolean {
  try {
    const seen = localStorage.getItem(SEEN_KEY) || '';
    return Boolean(currentVersion) && seen !== currentVersion;
  } catch {
    return false;
  }
}

export function markWhatsNewSeen(currentVersion = APP_VERSION): void {
  try {
    localStorage.setItem(SEEN_KEY, currentVersion);
  } catch {
    // ignore quota / private mode
  }
}

export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map((n) => Number(n) || 0);
  const pb = b.replace(/^v/i, '').split('.').map((n) => Number(n) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}
