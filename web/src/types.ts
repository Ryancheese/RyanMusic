export * from './visualizer-types';

export type MusicSource = 'netease' | 'qq';

export type HomeTab = 'netease' | 'qq';

/** 网易云首页：账号歌单 vs 发现推荐（参考 Folia Grid3D） */
export type NeteaseLibrarySection = 'playlists' | 'recommend';

export type LibraryLayoutMode = 'honeycomb' | 'square' | 'list';
export type LibraryCardStyle = 'cover' | 'plaque';
/** 列表布局：单列横条 / 多列网格 */
export type LibraryListColumns = 'single' | 'multi';

export type LoopMode = 'off' | 'all' | 'one';

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused';

export type AppView = 'home' | 'player';

export interface Track {
  type: MusicSource;
  songid: string;
  title: string;
  author: string;
  lrc: string;
  yrc?: string;
  tlyric?: string;
  /** 当前展示歌词实际来自哪个源 */
  lyricSource?: 'netease' | 'qq' | 'kugou' | 'amll' | 'native';
  /** 当前歌词在来源平台的曲目 ID（跨源匹配时与 songid 可能不同） */
  lyricProviderSongId?: string;
  url: string;
  pic: string;
  link?: string;
  album?: string;
  durationMs?: number;
  /** 平台侧已下架/无官方版权，播放将走 RyanMusic 跨渠道私链 */
  delisted?: boolean;
}

export interface SearchResponse {
  data: Track[];
  code: number;
  error: string;
  has_more?: boolean;
}

export interface LyricLine {
  time: number;
  text: string;
}

export interface ThemeTokens {
  name: string;
  backgroundColor: string;
  primaryColor: string;
  accentColor: string;
  secondaryColor: string;
}

export const MIDNIGHT_THEME: ThemeTokens = {
  name: 'Midnight Default',
  backgroundColor: '#09090b',
  primaryColor: '#f4f4f5',
  accentColor: '#f4f4f5',
  secondaryColor: '#71717a',
};

export const DAYLIGHT_THEME: ThemeTokens = {
  name: 'Daylight Default',
  backgroundColor: '#f5f5f4',
  primaryColor: '#1c1917',
  accentColor: '#ea580c',
  secondaryColor: '#44403c',
};

export function trackKey(track: Pick<Track, 'type' | 'songid'>): string {
  return `${track.type}:${track.songid}`;
}

export function libraryItem(track: Track) {
  return {
    type: track.type,
    songid: String(track.songid),
    title: track.title,
    author: track.author,
  };
}
