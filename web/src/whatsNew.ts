/** 当前应用版本（与 Info.plist / Windows Version / server package 保持一致） */
export const APP_VERSION = '1.8.59';

const SEEN_KEY = 'ryanmusic-whats-new-seen';

/** 本版启动后弹窗展示的更新说明 */
export const WHATS_NEW_NOTES = `• 修复更新后提示「未找到 Node.js」：安装包已内嵌 Node 运行时
• 全新黑胶风格 App 图标
• 歌词舞台底边留白与侧栏贴底修复，封面背景不再被挡住
• 登录后官链先约 320k 出声，音质探测不再拖慢首播
• 蜂窝 / 方形瀑布支持触控板捏合与 Cmd+滚轮缩放
• 歌词样式中文名调整；间奏省略号改为正圆点
• Esc 返回层级、歌单缓存与列表布局稳定性改进
• 首页「已登录」按钮挤压竖排修复`;

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
