const KEY = 'ryanmusic-playlist-recent-v1';

type Provider = 'netease' | 'qq';

interface RecentStore {
  netease: Record<string, number>;
  qq: Record<string, number>;
}

function readStore(): RecentStore {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null') as RecentStore | null;
    return {
      netease: parsed?.netease && typeof parsed.netease === 'object' ? parsed.netease : {},
      qq: parsed?.qq && typeof parsed.qq === 'object' ? parsed.qq : {},
    };
  } catch {
    return { netease: {}, qq: {} };
  }
}

function writeStore(store: RecentStore) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function touchPlaylistRecent(provider: Provider, playlistId: string, at = Date.now()) {
  const id = String(playlistId || '').trim();
  if (!id) return;
  const store = readStore();
  store[provider][id] = at;
  writeStore(store);
}

export function getPlaylistRecentAt(provider: Provider, playlistId: string): number {
  const id = String(playlistId || '').trim();
  if (!id) return 0;
  return readStore()[provider][id] || 0;
}
