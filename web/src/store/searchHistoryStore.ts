import { create } from 'zustand';

const KEY = 'ryanmusic-search-history-v2';
const LEGACY_KEY = 'ryanmusic-search-history-v1';
const MAX_ITEMS = 24;

export interface SearchHistoryItem {
  q: string;
  at: number;
}

function normalizeQuery(value: string): string {
  return String(value || '').trim();
}

function readItems(): SearchHistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY) || '[]';
    const parsed = JSON.parse(raw) as Array<{ q?: string; at?: number }>;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const items: SearchHistoryItem[] = [];
    for (const item of parsed) {
      const q = normalizeQuery(item?.q || '');
      if (!q || seen.has(q)) continue;
      seen.add(q);
      items.push({ q, at: Number(item.at) || 0 });
      if (items.length >= MAX_ITEMS) break;
    }
    return items;
  } catch {
    return [];
  }
}

interface SearchHistoryState {
  items: SearchHistoryItem[];
  push: (q: string) => void;
  remove: (q: string) => void;
  clear: () => void;
}

export const useSearchHistoryStore = create<SearchHistoryState>((set, get) => ({
  items: readItems(),
  push: (q) => {
    const query = normalizeQuery(q);
    if (!query || /^https?:\/\//i.test(query)) return;
    const next: SearchHistoryItem[] = [
      { q: query, at: Date.now() },
      ...get().items.filter((item) => item.q !== query),
    ].slice(0, MAX_ITEMS);
    set({ items: next });
    localStorage.setItem(KEY, JSON.stringify(next));
  },
  remove: (q) => {
    const query = normalizeQuery(q);
    const next = get().items.filter((item) => item.q !== query);
    set({ items: next });
    localStorage.setItem(KEY, JSON.stringify(next));
  },
  clear: () => {
    set({ items: [] });
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_KEY);
  },
}));
