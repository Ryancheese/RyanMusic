import type { LibraryCardStyle, LibraryLayoutMode, LibraryListColumns } from '../types';

export type { LibraryCardStyle, LibraryListColumns };

/** 歌单 / 歌曲库布局（蜂窝 / 方形 / 列表） */
export const LIBRARY_LAYOUT_MODE_IDS: LibraryLayoutMode[] = [
  'honeycomb',
  'square',
  'list',
];

export const LIBRARY_LAYOUT_MODE_LABELS: Record<LibraryLayoutMode, string> = {
  honeycomb: '蜂窝',
  square: '方形',
  list: '列表',
};

export const LIBRARY_LIST_COLUMNS_IDS: LibraryListColumns[] = ['single', 'multi'];

export const LIBRARY_LIST_COLUMNS_LABELS: Record<LibraryListColumns, string> = {
  single: '单列',
  multi: '多列',
};

/** 叠在蜂窝/方形上的卡片外观 */
export const LIBRARY_CARD_STYLE_IDS: LibraryCardStyle[] = ['cover', 'plaque'];

export const LIBRARY_CARD_STYLE_LABELS: Record<LibraryCardStyle, string> = {
  cover: '纯图片封面',
  plaque: '铭牌卡片',
};

export const LIBRARY_CARD_STYLE_HINT =
  '选择首页歌单卡片样式：纯图片封面，或在封面下方常驻显示名称的铭牌卡片。';
