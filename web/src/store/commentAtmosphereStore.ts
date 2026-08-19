import { create } from 'zustand';

const KEY = 'ryanmusic-comment-atmosphere-v1';

interface PersistedCommentAtmosphere {
  enabled?: boolean;
  typewriter?: boolean;
}

function readSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}') as PersistedCommentAtmosphere;
    return {
      enabled: parsed.enabled === true,
      typewriter: parsed.typewriter === true,
    };
  } catch {
    return { enabled: false, typewriter: false };
  }
}

interface CommentAtmosphereState {
  enabled: boolean;
  typewriter: boolean;
  setEnabled: (enabled: boolean) => void;
  setTypewriter: (enabled: boolean) => void;
}

const initial = readSettings();

export const useCommentAtmosphereStore = create<CommentAtmosphereState>((set) => ({
  enabled: initial.enabled,
  typewriter: initial.typewriter,
  setEnabled: (enabled) => set({ enabled }),
  setTypewriter: (typewriter) => set({ typewriter }),
}));

useCommentAtmosphereStore.subscribe((state) => {
  localStorage.setItem(KEY, JSON.stringify({
    enabled: state.enabled,
    typewriter: state.typewriter,
  }));
});
