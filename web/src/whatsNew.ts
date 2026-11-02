/** 当前应用版本（与 Info.plist / Windows Version / server package 保持一致） */
export const APP_VERSION = '2.0.15';

const SEEN_KEY = 'ryanmusic-whats-new-seen';

/** 本版启动后弹窗展示的更新说明 */
export const WHATS_NEW_NOTES = `• 新增町景舞台：街角微缩模型，歌词写在招牌和屏幕上
• 新增雾笺舞台：在起雾的车窗上写歌词，可切换街景、水族箱和共用背景
• 打开软件时播放开屏动画，并修复打开后黑屏
• 长时间暂停后如果进度在走但没有声音，会自动把声音接回来`;

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
