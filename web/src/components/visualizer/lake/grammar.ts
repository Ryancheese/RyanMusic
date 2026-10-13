import type { LakeLook, LakeOutline } from '../../../types';

// 湖面的演出和样子。画面本身是 Universe Anthem 的舞台源码（upstream/），
// 这里只保留设置面板上的名字。

export interface LakeOption<T extends string> {
  id: T;
  label: string;
}

export const LAKE_OUTLINES: LakeOption<LakeOutline>[] = [
  { id: 'lake', label: '静水' },
  { id: 'orbit', label: '环轨' },
  { id: 'strike', label: '切' },
  { id: 'still', label: '泊' },
  { id: 'screen', label: '屏' },
  { id: 'flow', label: '行' },
];

export const LAKE_LOOKS: LakeOption<LakeLook>[] = [
  { id: 'rock', label: '摇滚' },
  { id: 'pop', label: '流行' },
  { id: 'electro', label: '电子' },
  { id: 'hiphop', label: '嘻哈' },
  { id: 'anime', label: '二次元' },
  { id: 'soft', label: '轻柔' },
  { id: 'indie', label: '独立' },
];
