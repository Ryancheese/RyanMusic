import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CoverArt from './CoverArt';
import RyanLoader from './RyanLoader';
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
}

const CARD_GAP = 18;

function layoutForWidth(width: number) {
  if (width < 640) return { card: 132, spacingX: 158, spacingY: 158, maxDistance: 280 };
  if (width < 1024) return { card: 168, spacingX: 198, spacingY: 198, maxDistance: 380 };
  if (width < 1440) return { card: 196, spacingX: 228, spacingY: 228, maxDistance: 460 };
  return { card: 228, spacingX: 264, spacingY: 264, maxDistance: 540 };
}

export const AlbumWaterfall: React.FC<AlbumWaterfallProps> = ({
  items,
  onSelect,
  isDaylight,
  isLoading = false,
  emptyMessage = '还没有内容',
  hasFloatingPlayer = false,
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
  const [visible, setVisible] = useState<number[]>([0]);

  const layout = layoutForWidth(size.width);
  const clipRadius = Math.hypot(size.width, size.height) / 2 + layout.card;
  const showSkeleton = isLoading && items.length === 0;
  const showRefreshOverlay = isLoading && items.length > 0;

  const coords = useMemo(() => {
    coordsRef.current = resizeHexGridCoords(
      coordsRef.current,
      items.length,
      layout.spacingX,
      layout.spacingY,
    );
    return coordsRef.current;
  }, [items.length, layout.spacingX, layout.spacingY]);

  const coordByKey = useMemo(() => {
    const map = new Map<string, number>();
    coords.forEach((coord) => map.set(toCubeKey(coord.cube), coord.index));
    return map;
  }, [coords]);

  const ringRadius = Math.ceil(clipRadius / Math.min(layout.spacingX, layout.spacingY)) + 1;

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
    const center = pixelToCubeCenter(-dx, -dy, layout.spacingX, layout.spacingY);
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
  }, [clipRadius, coordByKey, coords, layout.card, layout.spacingX, layout.spacingY, ringRadius]);

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
    offsetRef.current = { x: 0, y: 0 };
    refreshVisible(0, 0);
    requestAnimationFrame(() => paint(0, 0));
  }, [items.length, layout.spacingX, layout.spacingY, paint, refreshVisible]);

  useEffect(() => {
    paint(offsetRef.current.x, offsetRef.current.y);
  }, [paint, visible]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
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
    if (!dragRef.current.active) return;
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
    const element = containerRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      offsetRef.current = {
        x: offsetRef.current.x - event.deltaX,
        y: offsetRef.current.y - event.deltaY,
      };
      paint(offsetRef.current.x, offsetRef.current.y);
      refreshVisible(offsetRef.current.x, offsetRef.current.y);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [paint, refreshVisible]);

  const skeletons = useMemo(
    () => resizeHexGridCoords([], 12, layout.spacingX, layout.spacingY),
    [layout.spacingX, layout.spacingY],
  );

  return (
    <div
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
                  height: layout.card,
                  marginLeft: -layout.card / 2,
                  marginTop: -layout.card / 2,
                  transform: `translate3d(${coord.baseX}px, ${coord.baseY}px, 0)`,
                  boxShadow: '0 14px 28px rgba(0,0,0,0.22)',
                }}
              >
                <div className="ryan-cover-shimmer h-full w-full" />
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
                    key={item.id}
                    type="button"
                    ref={(el) => {
                      cardRefs.current[index] = el;
                    }}
                    data-waterfall-index={index}
                    className="group absolute top-1/2 left-1/2 overflow-hidden rounded-2xl border-0 outline-none ring-0"
                    style={{
                      width: layout.card,
                      height: layout.card,
                      marginLeft: -layout.card / 2,
                      marginTop: -layout.card / 2,
                      willChange: 'transform, opacity',
                      isolation: 'isolate',
                      boxShadow: '0 14px 28px rgba(0,0,0,0.22)',
                      backgroundColor: isDaylight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
                    }}
                    onClick={(event) => event.preventDefault()}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      onSelect(item, index);
                    }}
                  >
                    <CoverArt src={item.coverUrl} />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-8 pb-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                      <div className="truncate text-left text-xs font-semibold text-white">{item.name}</div>
                      {item.description ? (
                        <div className="mt-0.5 truncate text-left text-[10px] text-white/70">{item.description}</div>
                      ) : null}
                    </div>
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
