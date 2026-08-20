/** 内存级歌单/曲目列表滚动位置（返回时恢复，不落盘） */

export type LibraryScrollPos =
  | { kind: 'scroll'; top: number }
  | { kind: 'pan'; x: number; y: number; zoom: number };

const positions = new Map<string, LibraryScrollPos>();

export function saveLibraryScroll(key: string, pos: LibraryScrollPos) {
  const id = String(key || '').trim();
  if (!id) return;
  if (pos.kind === 'scroll') {
    positions.set(id, { kind: 'scroll', top: Math.max(0, pos.top) });
    return;
  }
  positions.set(id, {
    kind: 'pan',
    x: pos.x,
    y: pos.y,
    zoom: pos.zoom,
  });
}

export function readLibraryScroll(key: string): LibraryScrollPos | undefined {
  const id = String(key || '').trim();
  if (!id) return undefined;
  return positions.get(id);
}
