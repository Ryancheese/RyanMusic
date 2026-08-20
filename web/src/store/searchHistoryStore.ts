import { create } from 'zustand';
import type { MusicSource } from '../types';

const KEY = 'ryanmusic-search-history-v1';
const MAX_ITEMS = 24;

export interface SearchHistoryItem {
  q: string;
  source: MusicSource;
  at: number;
}

function normalizeQuery(value: string): string {
  return String(value || '').trim();
}

function readItems(): SearchHistoryItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]') as SearchHistoryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.q === 'string' && item.q.trim())
      .map((item) => ({
        q: item.q.trim(),
        source: item.source === 'qq' ? 'qq' as const : 'netease' as const,
        at: Number(item.at) || 0,
      }))
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

interface SearchHistoryState {
  items: SearchHistoryItem[];
  push: (q: string, source: MusicSource) => void;
  remove: (q: string, source: MusicSource) => void;
  clear: () => void;
}

export const useSearchHistoryStore = create<SearchHistoryState>((set, get) => ({
  items: readItems(),
  push: (q, source) => {
    const query = normalizeQuery(q);
    if (!query || /^https?:\/\//i.test(query)) return;
    const next: SearchHistoryItem[] = [
      { q: query, source, at: Date.now() },
      ...get().items.filter((item) => !(item.q === query && item.source === source)),
    ].slice(0, MAX_ITEMS);
    set({ items: next });
    localStorage.setItem(KEY, JSON.stringify(next));
  },
  remove: (q, source) => {
    const query = normalizeQuery(q);
    const next = get().items.filter((item) => !(item.q === query && item.source === source));
    set({ items: next });
    localStorage.setItem(KEY, JSON.stringify(next));
  },
  clear: () => {
    set({ items: [] });
    localStorage.removeItem(KEY);
  },
}));
