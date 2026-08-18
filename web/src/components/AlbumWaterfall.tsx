import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CoverArt from './CoverArt';
import RyanLoader from './RyanLoader';
import type { LibraryCardStyle, LibraryLayoutMode } from '../types';
import {
  areIndexListsEqual,
  pixelToCubeCenter,
  resizeHexGridCoords,
  resolveVisibleHexIndexes,
  toCubeKey,
  type HexGridCoord,
} from './folia-grid/hexViewport';

export interface AlbumWaterfallItem {
  id: string;
  name: string;
  coverUrl?: string;
  description?: string;
}

interface AlbumWaterfallProps {
  items: AlbumWaterfallItem[];
  onSelect: (item: AlbumWaterfallItem, index: number) => void;
  isDaylight: boolean;
  isLoading?: boolean;
  emptyMessage?: string;
  hasFloatingPlayer?: boolean;
  layoutMode?: LibraryLayoutMode;
  /** 叠在蜂窝/方形上：纯封面或铭牌（下方常驻名称） */
  cardStyle?: LibraryCardStyle;
}

const CARD_GAP = 18;
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 1.9;

function layoutForWidth(width: number, mode: LibraryLayoutMode, zoom = 1) {
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
  const scale = (base: { card: number; spacingX: number; spacingY: number; maxDistance: number }) => ({
    card: Math.round(base.card * z),
    spacingX: Math.round(base.spacingX * z),
    spacingY: Math.round(base.spacingY * z),
    maxDistance: Math.round(base.maxDistance * z),
  });
  if (mode === 'square') {
    if (width < 640) return scale({ card: 124, spacingX: 148, spacingY: 148, maxDistance: 280 });
    if (width < 1024) return scale({ card: 156, spacingX: 184, spacingY: 184, maxDistance: 380 });
    if (width < 1440) return scale({ card: 180, spacingX: 212, spacingY: 212, maxDistance: 460 });
    return scale({ card: 208, spacingX: 244, spacingY: 244, maxDistance: 540 });
  }
  if (width < 640) return scale({ card: 132, spacingX: 158, spacingY: 158, maxDistance: 280 });
  if (width < 1024) return scale({ card: 168, spacingX: 198, spacingY: 198, maxDistance: 380 });
  if (width < 1440) return scale({ card: 196, spacingX: 228, spacingY: 228, maxDistance: 460 });
  return scale({ card: 228, spacingX: 264, spacingY: 264, maxDistance: 540 });
}

export const AlbumWaterfall: React.FC<AlbumWaterfallProps> = ({
  items,
  onSelect,
  isDaylight,
  isLoading = false,
  emptyMessage = '还没有内容',
  hasFloatingPlayer = false,
  layoutMode = 'square',
  cardStyle = 'plaque',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const coordsRef = useRef<HexGridCoord[]>([]);
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({
    active: false,
    captured: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    distance: 0,
  });
  const [size, setSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  }));
  const [zoom, setZoom] = useState(1);
  const [visible, setVisible] = useState<number[]>([0]);

  const isList = layoutMode === 'list';
  const isSquare = layoutMode === 'square';
  const isPlaque = layoutMode === 'honeycomb' && cardStyle === 'plaque';
  const layout = layoutForWidth(size.width, isSquare ? 'square' : layoutMode, zoom);
  const textReserve = isPlaque ? Math.round(layout.card * 0.46) : 0;
  const cellHeight = layout.card + textReserve;
  const rowSpacingY = layout.spacingY + textReserve;
  const clipRadius = Math.hypot(size.width, size.height) / 2 + Math.max(layout.card, cellHeight);
  const showSkeleton = isLoading && items.length === 0;
  const showRefreshOverlay = isLoading && items.length > 0;

  const coords = useMemo(() => {
    coordsRef.current = resizeHexGridCoords(coordsRef.current, items.length, layout.spacingX, rowSpacingY);
    return coordsRef.current;
  }, [items.length, layout.spacingX, rowSpacingY]);

  const coordByKey = useMemo(() => {
    const map = new Map<string, number>();
    coords.forEach((coord) => map.set(toCubeKey(coord.cube), coord.index));
    return map;
  }, [coords]);

  const ringRadius = Math.ceil(clipRadius / Math.min(layout.spacingX, rowSpacingY)) + 1;

  const applyCardFrame = useCallback((el: HTMLElement, coord: HexGridCoord, dx: number, dy: number) => {
    const centerX = coord.baseX + dx;
    const centerY = coord.baseY + dy;
    const dist = Math.hypot(centerX, centerY);
    const t = Math.min(dist / layout.maxDistance, 1);
    const hidden = dist > clipRadius;
    el.style.display = hidden ? 'none' : '';
    el.style.transform = `translate3d(${centerX}px, ${centerY}px, 0) scale(${1.08 - 0.42 * t})`;
    el.style.opacity = hidden ? '0' : String(1 - 0.55 * t);
    el.style.zIndex = String(Math.max(1, Math.round(40 - 39 * t)));
  }, [clipRadius, layout.maxDistance]);

  const refreshVisible = useCallback((dx: number, dy: number) => {
    const center = pixelToCubeCenter(-dx, -dy, layout.spacingX, rowSpacingY);
    const next = resolveVisibleHexIndexes(
      center,
      ringRadius,
      coordByKey,
      coords,
      -dx,
      -dy,
      clipRadius + layout.card + CARD_GAP,
    );
    setVisible((prev) => (areIndexListsEqual(prev, next) ? prev : next));
  }, [clipRadius, coordByKey, coords, layout.card, layout.spacingX, rowSpacingY, ringRadius]);

  const paint = useCallback((dx: number, dy: number) => {
    coords.forEach((coord) => {
      const el = cardRefs.current[coord.index];
      if (el) applyCardFrame(el, coord, dx, dy);
    });
  }, [applyCardFrame, coords]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isList || isSquare) return;
    offsetRef.current = { x: 0, y: 0 };
    refreshVisible(0, 0);
    requestAnimationFrame(() => paint(0, 0));
  }, [items.length, layout.spacingX, rowSpacingY, layoutMode, paint, refreshVisible, isList, isSquare, isPlaque, zoom]);

  useEffect(() => {
    if (isList || isSquare) return;
    paint(offsetRef.current.x, offsetRef.current.y);
  }, [paint, visible, isList, isSquare]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isList || isSquare || event.button !== 0) return;
    dragRef.current = {
      active: true,
      captured: false,
      startX: event.clientX,
      startY: event.clientY,
      originX: offsetRef.current.x,
      originY: offsetRef.current.y,
      distance: 0,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isList || !dragRef.current.active) return;
    const dist = Math.hypot(event.clientX - dragRef.current.startX, event.clientY - dragRef.current.startY);
    dragRef.current.distance = dist;
    if (dist >= 8 && !dragRef.current.captured) {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current.captured = true;
    }
    if (!dragRef.current.captured) return;
    const dx = dragRef.current.originX + (event.clientX - dragRef.current.startX);
    const dy = dragRef.current.originY + (event.clientY - dragRef.current.startY);
    offsetRef.current = { x: dx, y: dy };
    paint(dx, dy);
    refreshVisible(dx, dy);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isList || isSquare) return;
    const dragged = dragRef.current.distance >= 8;
    const captured = dragRef.current.captured;
    dragRef.current.active = false;
    dragRef.current.captured = false;
    if (captured) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    }
    if (dragged || showSkeleton || !items.length) return;
    const hit = (event.target as HTMLElement | null)?.closest?.('[data-waterfall-index]')
      || document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-waterfall-index]');
    if (!hit) return;
    const index = Number((hit as HTMLElement).dataset.waterfallIndex);
    const item = items[index];
    if (item) onSelect(item, index);
  };

  const endDrag = () => {
    dragRef.current.active = false;
    dragRef.current.captured = false;
  };

  useEffect(() => {
    if (isList || isSquare) return;
    const element = containerRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      // 触控板捏合在 macOS 上表现为 ctrl+wheel；Cmd+滚轮也可缩放
      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-event.deltaY * 0.008);
        setZoom((prev) => {
          const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev * factor));
          return Math.abs(next - prev) < 0.001 ? prev : next;
        });
        return;
      }
      offsetRef.current = {
        x: offsetRef.current.x - event.deltaX,
        y: offsetRef.current.y - event.deltaY,
      };
      paint(offsetRef.current.x, offsetRef.current.y);
      refreshVisible(offsetRef.current.x, offsetRef.current.y);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [paint, refreshVisible, isList, isSquare]);

  // 切换蜂窝/方形时重置缩放，避免间距错乱残留
  useEffect(() => {
    setZoom(1);
  }, [layoutMode]);

  const skeletons = useMemo(
    () => resizeHexGridCoords([], 12, layout.spacingX, rowSpacingY),
    [layout.spacingX, rowSpacingY],
  );


  if (isSquare) {
    const showPlaque = cardStyle === 'plaque';
    return (
      <div
        key="library-square"
        ref={containerRef}
        className="app-scroll hide-scrollbar relative min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto"
        style={{ paddingBottom: hasFloatingPlayer ? 'var(--player-dock-safe)' : '1.5rem' }}
      >
        <div
          className="mx-auto grid w-full gap-4 px-4 pb-4 sm:gap-5 sm:px-6 md:gap-6 md:px-8"
          style={{
            maxWidth: 1280,
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 156px), 1fr))',
          }}
        >
          {showSkeleton
            ? Array.from({ length: 12 }, (_, index) => (
                <div
                  key={`sk-square-${index}`}
                  className="flex flex-col rounded-2xl p-2.5"
                  style={{ backgroundColor: isDaylight ? 'rgba(0,0,0,0.04)' : 'rgba(12,12,12,0.92)' }}
                >
                  <div className="ryan-cover-shimmer aspect-square w-full rounded-xl" />
                  {showPlaque ? (
                    <>
                      <div className="ryan-cover-shimmer mt-3 h-3.5 w-4/5 rounded-full" />
                      <div className="ryan-cover-shimmer mt-2 h-2.5 w-1/2 rounded-full" />
                    </>
                  ) : null}
                </div>
              ))
            : items.length === 0
              ? (
                  <div className="col-span-full flex flex-col items-center justify-center gap-4 py-16 text-center">
                    {isLoading ? <RyanLoader size={56} label={emptyMessage} /> : (
                      <p className="text-sm opacity-40">{emptyMessage}</p>
                    )}
                  </div>
                )
              : items.map((item, index) => (
                  <button
                    key={`square-${item.id}`}
                    type="button"
                    onClick={() => onSelect(item, index)}
                    title={item.name}
                    className="app-scroll-item group flex w-full flex-col rounded-2xl p-2.5 text-left transition hover:brightness-110"
                    style={{
                      backgroundColor: isDaylight ? 'rgba(0,0,0,0.045)' : 'rgba(18,18,18,0.96)',
                      boxShadow: isDaylight
                        ? '0 8px 22px rgba(0,0,0,0.08)'
                        : '0 10px 28px rgba(0,0,0,0.45)',
                    }}
                  >
                    <div
                      className="relative aspect-square w-full overflow-hidden rounded-xl"
                      style={{ backgroundColor: isDaylight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }}
                    >
                      <CoverArt src={item.coverUrl} lazy={false} />
                      {!showPlaque ? (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3 pt-10 pb-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <div className="truncate text-xs font-semibold text-white">{item.name}</div>
                        </div>
                      ) : null}
                    </div>
                    {showPlaque ? (
                      <div className="min-w-0 px-0.5 pt-2.5 pb-0.5">
                        <div className="truncate text-[13px] font-semibold leading-snug tracking-tight">
                          {item.name}
                        </div>
                        {item.description ? (
                          <div className="mt-1 truncate text-[11px] leading-snug opacity-45">
                            {item.description}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                ))}
        </div>
        {showRefreshOverlay ? (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
            <RyanLoader size={52} label="同步中…" />
          </div>
        ) : null}
      </div>
    );
  }

  if (isList) {
    return (
      <div
        key="library-list"
        ref={containerRef}
        className="relative min-h-0 w-full flex-1 overflow-y-auto"
        style={{ paddingBottom: hasFloatingPlayer ? '5.5rem' : '1.5rem' }}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 pb-4 md:px-8">
          {showSkeleton
            ? Array.from({ length: 8 }, (_, index) => (
                <div
                  key={`sk-list-${index}`}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
                  style={{ backgroundColor: isDaylight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)' }}
                >
                  <div className="ryan-cover-shimmer h-14 w-14 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="ryan-cover-shimmer h-3 w-2/3 rounded-full" />
                    <div className="ryan-cover-shimmer h-2.5 w-1/3 rounded-full" />
                  </div>
                </div>
              ))
            : items.length === 0
              ? (
                  <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                    {isLoading ? <RyanLoader size={56} label={emptyMessage} /> : (
                      <p className="text-sm opacity-40">{emptyMessage}</p>
                    )}
                  </div>
                )
              : items.map((item, index) => (
                  <button
                    key={`list-${item.id}`}
                    type="button"
                    onClick={() => onSelect(item, index)}
                    className={`relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                      isDaylight ? 'hover:bg-black/6' : 'hover:bg-white/8'
                    }`}
                    style={{
                      position: 'relative',
                      transform: 'none',
                      opacity: 1,
                      left: 'auto',
                      top: 'auto',
                      backgroundColor: isDaylight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)',
                    }}
                  >
                    <div
                      className="h-14 w-14 shrink-0 overflow-hidden rounded-xl"
                      style={{ backgroundColor: isDaylight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }}
                    >
                      <CoverArt src={item.coverUrl} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{item.name}</div>
                      {item.description ? (
                        <div className="mt-0.5 truncate text-xs opacity-50">{item.description}</div>
                      ) : null}
                    </div>
                  </button>
                ))}
        </div>
        {showRefreshOverlay ? (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
            <RyanLoader size={52} label="同步中…" />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      key={`library-grid-${layoutMode}`}
      ref={containerRef}
      className="relative min-h-0 w-full flex-1 cursor-grab overflow-hidden touch-none select-none active:cursor-grabbing"
      style={{ paddingBottom: hasFloatingPlayer ? '5.5rem' : '1.5rem' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={endDrag}
    >
      <div className="absolute inset-0">
        {showSkeleton
          ? skeletons.map((coord) => (
              <div
                key={`sk-${coord.index}`}
                className="absolute top-1/2 left-1/2 overflow-hidden rounded-2xl"
                style={{
                  width: layout.card,
                  height: cellHeight,
                  marginLeft: -layout.card / 2,
                  marginTop: -cellHeight / 2,
                  transform: `translate3d(${coord.baseX}px, ${coord.baseY}px, 0)`,
                  boxShadow: '0 14px 28px rgba(0,0,0,0.22)',
                }}
              >
                <div className="ryan-cover-shimmer w-full" style={{ height: layout.card }} />
                {isPlaque ? <div className="ryan-cover-shimmer mx-2 mt-2 h-2.5 w-3/4 rounded-full" /> : null}
              </div>
            ))
          : items.length === 0
            ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
                  {isLoading ? <RyanLoader size={56} label={emptyMessage} /> : (
                    <p className="text-sm opacity-40">{emptyMessage}</p>
                  )}
                </div>
              )
            : visible.map((index) => {
                const item = items[index];
                const coord = coords[index];
                if (!item || !coord) return null;
                return (
                  <button
                    key={`grid-${layoutMode}-${item.id}`}
                    type="button"
                    ref={(el) => {
                      cardRefs.current[index] = el;
                    }}
                    data-waterfall-index={index}
                    className={`group absolute top-1/2 left-1/2 overflow-hidden rounded-2xl border-0 outline-none ring-0 ${isPlaque ? 'flex flex-col p-2.5 transition hover:brightness-110' : ''}`}
                    style={{
                      width: layout.card,
                      height: cellHeight,
                      marginLeft: -layout.card / 2,
                      marginTop: -cellHeight / 2,
                      willChange: 'transform, opacity',
                      isolation: 'isolate',
                      boxShadow: isPlaque
                        ? (isDaylight ? '0 8px 22px rgba(0,0,0,0.08)' : '0 10px 28px rgba(0,0,0,0.45)')
                        : '0 14px 28px rgba(0,0,0,0.22)',
                      backgroundColor: isPlaque
                        ? (isDaylight ? 'rgba(0,0,0,0.045)' : 'rgba(18,18,18,0.96)')
                        : (isDaylight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'),
                    }}
                    onClick={(event) => event.preventDefault()}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      onSelect(item, index);
                    }}
                  >
                    <div
                      className={`relative z-0 w-full overflow-hidden ${isPlaque ? 'rounded-xl' : ''}`}
                      style={{
                        height: isPlaque ? layout.card - 20 : layout.card,
                        backgroundColor: isPlaque
                          ? (isDaylight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)')
                          : undefined,
                      }}
                    >
                      <CoverArt src={item.coverUrl} />
                      {!isPlaque ? (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3 pt-10 pb-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                          <div className="truncate text-left text-xs font-semibold text-white">{item.name}</div>
                        </div>
                      ) : null}
                    </div>
                    {isPlaque ? (
                      <div className="min-w-0 px-0.5 pt-2.5 pb-0.5 text-left" style={{ height: textReserve - 10 }}>
                        <div className="truncate text-[13px] font-semibold leading-snug tracking-tight">
                          {item.name}
                        </div>
                        {item.description ? (
                          <div className="mt-1 truncate text-[11px] leading-snug opacity-45">
                            {item.description}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                );
              })}
      </div>
      {showRefreshOverlay ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
          <RyanLoader size={52} label="同步中…" />
        </div>
      ) : null}
    </div>
  );
};
