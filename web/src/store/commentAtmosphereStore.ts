import { create } from 'zustand';

const KEY = 'ryanmusic-comment-atmosphere-v1';

export type CommentReadOrder = 'sequential' | 'random' | 'reverse';

export const COMMENT_READ_ORDER_OPTIONS: { id: CommentReadOrder; label: string; hint: string }[] = [
  { id: 'sequential', label: '顺序', hint: '按接口返回的先后读' },
  { id: 'random', label: '随机', hint: '打乱后循环读' },
  { id: 'reverse', label: '倒序', hint: '从列表末尾往前读' },
];

export function isCommentReadOrder(value: unknown): value is CommentReadOrder {
  return value === 'sequential' || value === 'random' || value === 'reverse';
}

interface PersistedCommentAtmosphere {
  enabled?: boolean;
  typewriter?: boolean;
  readOrder?: string;
}

function readSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}') as PersistedCommentAtmosphere;
    return {
      enabled: parsed.enabled === true,
      typewriter: parsed.typewriter === true,
      readOrder: isCommentReadOrder(parsed.readOrder) ? parsed.readOrder : 'sequential' as CommentReadOrder,
    };
  } catch {
    return {
      enabled: false,
      typewriter: false,
      readOrder: 'sequential' as CommentReadOrder,
    };
  }
}

interface CommentAtmosphereState {
  enabled: boolean;
  typewriter: boolean;
  readOrder: CommentReadOrder;
  setEnabled: (enabled: boolean) => void;
  setTypewriter: (enabled: boolean) => void;
  setReadOrder: (readOrder: CommentReadOrder) => void;
}

const initial = readSettings();

export const useCommentAtmosphereStore = create<CommentAtmosphereState>((set) => ({
  enabled: initial.enabled,
  typewriter: initial.typewriter,
  readOrder: initial.readOrder,
  setEnabled: (enabled) => set({ enabled }),
  setTypewriter: (typewriter) => set({ typewriter }),
  setReadOrder: (readOrder) => set({ readOrder }),
}));

useCommentAtmosphereStore.subscribe((state) => {
  localStorage.setItem(KEY, JSON.stringify({
    enabled: state.enabled,
    typewriter: state.typewriter,
    readOrder: state.readOrder,
  }));
});
