/** 公开安装包仓（与 shared/releases-repo.txt 保持一致） */
export const RELEASES_REPO = 'Ryancheese/RyanMusic-Releases';
/** 1.8.67 及更早客户端仍查源码仓；CI 会镜像安装包到该仓 release */
export const LEGACY_RELEASES_REPO = 'Ryancheese/RyanMusic';
export const RELEASES_PAGE_URL = `https://github.com/${RELEASES_REPO}/releases/latest`;
export const RELEASES_API_URL = `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`;
export const LEGACY_RELEASES_PAGE_URL = `https://github.com/${LEGACY_RELEASES_REPO}/releases/latest`;
export const LEGACY_RELEASES_API_URL = `https://api.github.com/repos/${LEGACY_RELEASES_REPO}/releases/latest`;
