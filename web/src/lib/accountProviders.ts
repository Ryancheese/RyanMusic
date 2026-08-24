import type { AccountStatus } from '../api';

/** 账号平台（后续可继续往数组里加） */
export type AccountProviderId = 'netease' | 'qq' | 'kugou';

export interface AccountProviderMeta {
  id: AccountProviderId;
  label: string;
  shortLabel: string;
  /** 无头像时的单字角标 */
  mark: string;
  markClass: string;
  logoutAction: string;
  /** 是否同步云端歌单到首页 */
  hasCloudLibrary: boolean;
}

export const ACCOUNT_PROVIDERS: AccountProviderMeta[] = [
  {
    id: 'netease',
    label: '网易云',
    shortLabel: '网易云',
    mark: '云',
    markClass: 'bg-[#e60026] text-white',
    logoutAction: 'netease_logout',
    hasCloudLibrary: true,
  },
  {
    id: 'qq',
    label: 'QQ 音乐',
    shortLabel: 'QQ',
    mark: 'Q',
    markClass: 'bg-[#31c27c] text-white',
    logoutAction: 'qq_logout',
    hasCloudLibrary: true,
  },
  {
    id: 'kugou',
    label: '酷狗音乐',
    shortLabel: '酷狗',
    mark: '狗',
    markClass: 'bg-[#00a9ff] text-white',
    logoutAction: 'kugou_logout',
    hasCloudLibrary: false,
  },
];

export function providerMeta(id: AccountProviderId): AccountProviderMeta {
  return ACCOUNT_PROVIDERS.find((item) => item.id === id) || ACCOUNT_PROVIDERS[0];
}

export function accountOf(
  id: AccountProviderId,
  netease: AccountStatus | null,
  qq: AccountStatus | null,
  kugou: AccountStatus | null = null,
): AccountStatus | null {
  if (id === 'qq') return qq;
  if (id === 'kugou') return kugou;
  return netease;
}

/** 已登录账号的会员说明（主句） */
export function membershipHeadline(account: AccountStatus | null | undefined): string {
  if (!account?.loggedIn) return '';
  const name = account.nickname?.trim() || '已登录';
  if (Number(account.vip) > 0) return `已登录：${name} · 会员`;
  return `已登录：${name} · 非会员`;
}

/** 已登录账号的会员说明（副句） */
export function membershipHint(account: AccountStatus | null | undefined): string {
  if (!account?.loggedIn) {
    return '登录后会员可走官方音源；非会员将使用外部音源，加载可能会稍慢。';
  }
  if (Number(account.vip) > 0) {
    return '当前为会员账号，优先使用官方音源与逐字歌词。';
  }
  return '当前为非会员账号，将使用外部音源，加载可能会稍慢。';
}

export function platformStatusLine(account: AccountStatus | null | undefined): string {
  if (!account?.loggedIn) return '未登录 · 点击登录';
  const name = account.nickname?.trim();
  if (Number(account.vip) > 0) return name ? `${name} · 会员` : '已登录 · 会员';
  return name ? name : '已登录';
}

/** 胶囊主文案：已登录优先显示昵称 */
export function capsuleDisplayName(
  account: AccountStatus | null | undefined,
  platformShort: string,
): string {
  if (!account?.loggedIn) return '登录';
  return account.nickname?.trim() || platformShort;
}
