import { create } from 'zustand';

export type AppToastKind = 'success' | 'error' | 'info';

export interface AppToast {
  id: string;
  kind: AppToastKind;
  title: string;
  detail?: string;
}

interface ToastState {
  toasts: AppToast[];
  showToast: (toast: Omit<AppToast, 'id'> & { id?: string }) => string;
  dismissToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (toast) => {
    const id = toast.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((state) => ({
      toasts: [...state.toasts.filter((item) => item.id !== id), { ...toast, id }].slice(-3),
    }));
    return id;
  },
  dismissToast: (id) => set((state) => ({
    toasts: state.toasts.filter((item) => item.id !== id),
  })),
}));

export function showToast(toast: Omit<AppToast, 'id'> & { id?: string }) {
  return useToastStore.getState().showToast(toast);
}
