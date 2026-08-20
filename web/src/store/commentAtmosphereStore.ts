import { create } from 'zustand';

const KEY = 'ryanmusic-comment-atmosphere-v1';

export type CommentReadOrder = 'sequential' | 'random' | 'reverse';
export type CommentMixBias = 'hot' | 'latest';

export const COMMENT_READ_ORDER_OPTIONS: { id: CommentReadOrder; label: string; hint: string }[] = [
  { id: 'sequential', label: '顺序', hint: '按接口返回的先后读' },
  { id: 'random', label: '随机', hint: '打乱后循环读' },
  { id: 'reverse', label: '倒序', hint: '从列表末尾往前读' },
];

export const COMMENT_MIX_OPTIONS: { id: CommentMixBias; label: string; hint: string }[] = [
  { id: 'latest', label: '最近优先', hint: '约 70% 最新评论' },
  { id: 'hot', label: '热度优先', hint: '约 70% 热评' },
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
  setEnabled: (enabled: boolean) => void;
  setTypewriter: (enabled: boolean) => void;
  setReadOrder: (readOrder: CommentReadOrder) => void;
  setCrowdMode: (enabled: boolean) => void;
  setCrowdCount: (count: CrowdCount) => void;
  setFontScale: (fontScale: number) => void;
  setMixBias: (mixBias: CommentMixBias) => void;
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
  setEnabled: (enabled) => set({ enabled }),
  setTypewriter: (typewriter) => set({ typewriter }),
  setReadOrder: (readOrder) => set({ readOrder }),
  setCrowdMode: (crowdMode) => set({ crowdMode }),
  setCrowdCount: (crowdCount) => set({ crowdCount: clampCrowdCount(crowdCount) }),
  setFontScale: (fontScale) => set({ fontScale: clampCommentFontScale(fontScale) }),
  setMixBias: (mixBias) => set({ mixBias: isCommentMixBias(mixBias) ? mixBias : 'hot' }),
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
  }));
});
