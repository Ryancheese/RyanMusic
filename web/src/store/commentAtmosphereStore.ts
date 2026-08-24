import { create } from 'zustand';

const KEY = 'ryanmusic-comment-atmosphere-v1';

export type CommentReadOrder = 'sequential' | 'random' | 'reverse';
export type CommentMixBias = 'hot' | 'latest';
export type CommentPlatform = 'netease' | 'qq' | 'kugou';

export const COMMENT_READ_ORDER_OPTIONS: { id: CommentReadOrder; label: string; hint: string }[] = [
  { id: 'sequential', label: '顺序', hint: '按接口返回的先后读' },
  { id: 'random', label: '随机', hint: '打乱后依次读，不重复' },
  { id: 'reverse', label: '倒序', hint: '从列表末尾往前读' },
];

export const COMMENT_MIX_OPTIONS: { id: CommentMixBias; label: string; hint: string }[] = [
  { id: 'latest', label: '最近优先', hint: '约 70% 最新评论' },
  { id: 'hot', label: '热度优先', hint: '约 70% 热评' },
];

export const COMMENT_PLATFORM_OPTIONS: { id: CommentPlatform; label: string; short: string }[] = [
  { id: 'netease', label: '网易云', short: '网易' },
  { id: 'qq', label: 'QQ 音乐', short: 'QQ' },
  { id: 'kugou', label: '酷狗', short: '酷狗' },
];

export const CROWD_COUNT_OPTIONS = [2, 3, 4] as const;
export type CrowdCount = (typeof CROWD_COUNT_OPTIONS)[number];

export const COMMENT_FONT_SCALE_MIN = 100;
export const COMMENT_FONT_SCALE_MAX = 200;
export const COMMENT_FONT_SCALE_DEFAULT = 100;

export function isCommentReadOrder(value: unknown): value is CommentReadOrder {
  return value === 'sequential' || value === 'random' || value === 'reverse';
}

export function isCommentMixBias(value: unknown): value is CommentMixBias {
  return value === 'hot' || value === 'latest';
}

export function isCommentPlatform(value: unknown): value is CommentPlatform {
  return value === 'netease' || value === 'qq' || value === 'kugou';
}

export function commentPlatformLabel(source: CommentPlatform | string | undefined): string {
  if (source === 'qq') return 'QQ 音乐';
  if (source === 'kugou') return '酷狗';
  return '网易云';
}

function clampCrowdCount(value: unknown): CrowdCount {
  const n = Number(value);
  if (n === 2 || n === 3 || n === 4) return n;
  return 3;
}

export function clampCommentFontScale(value: unknown): number {
  const n = Math.round(Number(value) / 5) * 5;
  if (!Number.isFinite(n)) return COMMENT_FONT_SCALE_DEFAULT;
  return Math.min(COMMENT_FONT_SCALE_MAX, Math.max(COMMENT_FONT_SCALE_MIN, n));
}

interface PersistedCommentAtmosphere {
  enabled?: boolean;
  typewriter?: boolean;
  readOrder?: string;
  crowdMode?: boolean;
  crowdCount?: number;
  fontScale?: number;
  mixBias?: string;
  commentSource?: string;
  autoBestComment?: boolean;
}

function readSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}') as PersistedCommentAtmosphere;
    return {
      enabled: parsed.enabled === true,
      typewriter: parsed.typewriter === true,
      readOrder: isCommentReadOrder(parsed.readOrder) ? parsed.readOrder : 'sequential' as CommentReadOrder,
      crowdMode: parsed.crowdMode === true,
      crowdCount: clampCrowdCount(parsed.crowdCount),
      fontScale: clampCommentFontScale(parsed.fontScale ?? COMMENT_FONT_SCALE_DEFAULT),
      mixBias: isCommentMixBias(parsed.mixBias) ? parsed.mixBias : 'hot' as CommentMixBias,
      commentSource: isCommentPlatform(parsed.commentSource) ? parsed.commentSource : 'netease' as CommentPlatform,
      // 默认开启：按评论数自动选平台
      autoBestComment: parsed.autoBestComment !== false,
    };
  } catch {
    return {
      enabled: false,
      typewriter: false,
      readOrder: 'sequential' as CommentReadOrder,
      crowdMode: false,
      crowdCount: 3 as CrowdCount,
      fontScale: COMMENT_FONT_SCALE_DEFAULT,
      mixBias: 'hot' as CommentMixBias,
      commentSource: 'netease' as CommentPlatform,
      autoBestComment: true,
    };
  }
}

interface CommentAtmosphereState {
  enabled: boolean;
  typewriter: boolean;
  readOrder: CommentReadOrder;
  crowdMode: boolean;
  crowdCount: CrowdCount;
  fontScale: number;
  mixBias: CommentMixBias;
  commentSource: CommentPlatform;
  autoBestComment: boolean;
  setEnabled: (enabled: boolean) => void;
  setTypewriter: (enabled: boolean) => void;
  setReadOrder: (readOrder: CommentReadOrder) => void;
  setCrowdMode: (enabled: boolean) => void;
  setCrowdCount: (count: CrowdCount) => void;
  setFontScale: (fontScale: number) => void;
  setMixBias: (mixBias: CommentMixBias) => void;
  setCommentSource: (commentSource: CommentPlatform) => void;
  setAutoBestComment: (enabled: boolean) => void;
  /** 评论区一键切换：自动 / 指定平台 */
  selectCommentPlatform: (value: 'auto' | CommentPlatform) => void;
}

const initial = readSettings();

export const useCommentAtmosphereStore = create<CommentAtmosphereState>((set) => ({
  enabled: initial.enabled,
  typewriter: initial.typewriter,
  readOrder: initial.readOrder,
  crowdMode: initial.crowdMode,
  crowdCount: initial.crowdCount,
  fontScale: initial.fontScale,
  mixBias: initial.mixBias,
  commentSource: initial.commentSource,
  autoBestComment: initial.autoBestComment,
  setEnabled: (enabled) => set({ enabled }),
  setTypewriter: (typewriter) => set({ typewriter }),
  setReadOrder: (readOrder) => set({ readOrder }),
  setCrowdMode: (crowdMode) => set({ crowdMode }),
  setCrowdCount: (crowdCount) => set({ crowdCount: clampCrowdCount(crowdCount) }),
  setFontScale: (fontScale) => set({ fontScale: clampCommentFontScale(fontScale) }),
  setMixBias: (mixBias) => set({ mixBias: isCommentMixBias(mixBias) ? mixBias : 'hot' }),
  setCommentSource: (commentSource) => set({
    commentSource: isCommentPlatform(commentSource) ? commentSource : 'netease',
    autoBestComment: false,
  }),
  setAutoBestComment: (autoBestComment) => set({ autoBestComment }),
  selectCommentPlatform: (value) => {
    if (value === 'auto') {
      set({ autoBestComment: true });
      return;
    }
    set({
      autoBestComment: false,
      commentSource: isCommentPlatform(value) ? value : 'netease',
    });
  },
}));

useCommentAtmosphereStore.subscribe((state) => {
  localStorage.setItem(KEY, JSON.stringify({
    enabled: state.enabled,
    typewriter: state.typewriter,
    readOrder: state.readOrder,
    crowdMode: state.crowdMode,
    crowdCount: state.crowdCount,
    fontScale: state.fontScale,
    mixBias: state.mixBias,
    commentSource: state.commentSource,
    autoBestComment: state.autoBestComment,
  }));
});
