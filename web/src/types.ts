export * from './visualizer-types';

export type MusicSource = 'netease' | 'qq';

export type HomeTab = 'liked' | 'recent' | 'playlist';

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
  url: string;
  pic: string;
  link?: string;
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
