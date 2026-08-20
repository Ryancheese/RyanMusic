import { create } from 'zustand';

const KEY = 'ryanmusic-comment-atmosphere-v1';

export type CommentReadOrder = 'sequential' | 'random' | 'reverse';

export const COMMENT_READ_ORDER_OPTIONS: { id: CommentReadOrder; label: string; hint: string }[] = [
  { id: 'sequential', label: '顺序', hint: '按接口返回的先后读' },
  { id: 'random', label: '随机', hint: '打乱后循环读' },
  { id: 'reverse', label: '倒序', hint: '从列表末尾往前读' },
];

export const CROWD_COUNT_OPTIONS = [2, 3, 4] as const;
export type CrowdCount = (typeof CROWD_COUNT_OPTIONS)[number];

export function isCommentReadOrder(value: unknown): value is CommentReadOrder {
  return value === 'sequential' || value === 'random' || value === 'reverse';
}

function clampCrowdCount(value: unknown): CrowdCount {
  const n = Number(value);
  if (n === 2 || n === 3 || n === 4) return n;
  return 3;
}

interface PersistedCommentAtmosphere {
  enabled?: boolean;
  typewriter?: boolean;
  readOrder?: string;
  crowdMode?: boolean;
  crowdCount?: number;
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
    };
  } catch {
    return {
      enabled: false,
      typewriter: false,
      readOrder: 'sequential' as CommentReadOrder,
      crowdMode: false,
      crowdCount: 3 as CrowdCount,
    };
  }
}

interface CommentAtmosphereState {
  enabled: boolean;
  typewriter: boolean;
  readOrder: CommentReadOrder;
  crowdMode: boolean;
  crowdCount: CrowdCount;
  setEnabled: (enabled: boolean) => void;
  setTypewriter: (enabled: boolean) => void;
  setReadOrder: (readOrder: CommentReadOrder) => void;
  setCrowdMode: (enabled: boolean) => void;
  setCrowdCount: (count: CrowdCount) => void;
}

const initial = readSettings();

export const useCommentAtmosphereStore = create<CommentAtmosphereState>((set) => ({
  enabled: initial.enabled,
  typewriter: initial.typewriter,
  readOrder: initial.readOrder,
  crowdMode: initial.crowdMode,
  crowdCount: initial.crowdCount,
  setEnabled: (enabled) => set({ enabled }),
  setTypewriter: (typewriter) => set({ typewriter }),
  setReadOrder: (readOrder) => set({ readOrder }),
  setCrowdMode: (crowdMode) => set({ crowdMode }),
  setCrowdCount: (crowdCount) => set({ crowdCount: clampCrowdCount(crowdCount) }),
}));

useCommentAtmosphereStore.subscribe((state) => {
  localStorage.setItem(KEY, JSON.stringify({
    enabled: state.enabled,
    typewriter: state.typewriter,
    readOrder: state.readOrder,
    crowdMode: state.crowdMode,
    crowdCount: state.crowdCount,
  }));
});
