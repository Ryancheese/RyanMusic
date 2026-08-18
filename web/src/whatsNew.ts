/** 当前应用版本（与 Info.plist / Windows Version / server package 保持一致） */
export const APP_VERSION = '1.8.61';

const SEEN_KEY = 'ryanmusic-whats-new-seen';

/** 本版启动后弹窗展示的更新说明 */
export const WHATS_NEW_NOTES = `• 页面滑动更顺：惯性平移、减少滚动时模糊和频谱开销
• Folia 网关不可用时回退 Meting，避免完全没声
• 短试听（约 30–45 秒）会改切其它音源；电脑端会员仍优先官方完整音质
• 电脑端扫码登录不变；网页端默认走私链、关闭扫码
• 登录态改为浏览器 Cookie，Vercel 上同步歌单不再丢登录`;

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
