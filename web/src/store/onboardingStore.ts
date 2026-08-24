import { create } from 'zustand';

const KEY = 'ryanmusic-onboarding-v1';

function readCompleted(): boolean {
  try {
    return localStorage.getItem(KEY) === 'done';
  } catch {
    return false;
  }
}

function writeCompleted() {
  try {
    localStorage.setItem(KEY, 'done');
  } catch {
    // ignore
  }
}

interface OnboardingState {
  completed: boolean;
  active: boolean;
  stepIndex: number;
  start: () => void;
  next: (total: number) => void;
  prev: () => void;
  skip: () => void;
  complete: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  completed: readCompleted(),
  active: false,
  stepIndex: 0,
  start: () => set({ active: true, stepIndex: 0 }),
  next: (total) => {
    const { stepIndex } = get();
    if (stepIndex >= total - 1) {
      writeCompleted();
      set({ active: false, completed: true, stepIndex: 0 });
      return;
    }
    set({ stepIndex: stepIndex + 1 });
  },
  prev: () => set({ stepIndex: Math.max(0, get().stepIndex - 1) }),
  skip: () => {
    writeCompleted();
    set({ active: false, completed: true, stepIndex: 0 });
  },
  complete: () => {
    writeCompleted();
    set({ active: false, completed: true, stepIndex: 0 });
  },
}));

export const hasCompletedOnboarding = () => useOnboardingStore.getState().completed;
