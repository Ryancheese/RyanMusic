import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CoverArt from './CoverArt';
import DelistedCoverBadge from './DelistedCoverBadge';
import RyanLoader from './RyanLoader';
import type { LibraryCardStyle, LibraryLayoutMode } from '../types';
import { isWindowsApp } from '../lib/media';
import { readLibraryScroll, saveLibraryScroll } from '../store/libraryScrollStore';
import { useLibraryStore } from '../store/libraryStore';
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
  delisted?: boolean;
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
  /** 用于进出歌单后恢复滚动位置 */
  scrollKey?: string;
}

const CARD_GAP = 18;
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 1.9;
const PAN_RUBBER = 0.32;
const PAN_BOUNCE_MS = 280;

function libraryCardSurface(isDaylight: boolean, plaque = false) {
  if (plaque) {
    return {
      backgroundColor: isDaylight ? 'rgba(255,255,255,0.94)' : 'rgba(34,34,38,0.98)',
      border: isDaylight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
      boxShadow: isDaylight
        ? '0 10px 26px rgba(0,0,0,0.12)'
        : '0 12px 32px rgba(0,0,0,0.55)',
    };
  }
  return {
    backgroundColor: isDaylight ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.08)',
    border: isDaylight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)',
    boxShadow: isDaylight
      ? '0 10px 24px rgba(0,0,0,0.14)'
      : '0 14px 30px rgba(0,0,0,0.48)',
  };
}

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

type PanLimits = { minX: number; maxX: number; minY: number; maxY: number };

function computePanLimits(
  coords: HexGridCoord[],
  card: number,
  cellHeight: number,
  viewW: number,
  viewH: number,
): PanLimits {
  if (!coords.length || viewW < 8 || viewH < 8) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
  let minBX = Infinity;
  let maxBX = -Infinity;
  let minBY = Infinity;
  let maxBY = -Infinity;
  for (const coord of coords) {
    minBX = Math.min(minBX, coord.baseX - card / 2);
    maxBX = Math.max(maxBX, coord.baseX + card / 2);
    minBY = Math.min(minBY, coord.baseY - cellHeight / 2);
    maxBY = Math.max(maxBY, coord.baseY + cellHeight / 2);
  }
  // 边缘卡片至少还能靠近视口中心一带，避免拖进大片空白
  const marginX = Math.min(viewW * 0.38, card * 1.35);
  const marginY = Math.min(viewH * 0.38, cellHeight * 1.35);
  let minX = -viewW / 2 - maxBX + marginX;
  let maxX = viewW / 2 - minBX - marginX;
  let minY = -viewH / 2 - maxBY + marginY;
  let maxY = viewH / 2 - minBY - marginY;
  if (minX > maxX) {
    const mid = (minX + maxX) / 2;
    minX = mid;
    maxX = mid;
  }
  if (minY > maxY) {
    const mid = (minY + maxY) / 2;
    minY = mid;
    maxY = mid;
  }
  return { minX, maxX, minY, maxY };
}

function rubberBand(value: number, min: number, max: number, factor = PAN_RUBBER): number {
  if (value < min) return min - (min - value) * factor;
  if (value > max) return max + (value - max) * factor;
  return value;
}

function clampPan(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(t: number): number {
  return 1 - ((1 - t) ** 3);
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
  scrollKey = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const coordsRef = useRef<HexGridCoord[]>([]);
  const offsetRef = useRef({ x: 0, y: 0 });
  const scrollKeyRef = useRef(scrollKey);
  const restoredKeyRef = useRef('');
  const dragRef = useRef({
    active: false,
    captured: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    distance: 0,
  });
  const rafPaintRef = useRef(0);
  const pendingOffsetRef = useRef({ x: 0, y: 0 });
  const lastVisibleAtRef = useRef(0);
  const lastVisibleOffsetRef = useRef({ x: 0, y: 0 });
  const forceVisibleRef = useRef(false);
  const bounceRafRef = useRef(0);
  const [size, setSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  }));
  const [zoom, setZoom] = useState(1);
  const [visible, setVisible] = useState<number[]>([0]);

  scrollKeyRef.current = scrollKey;

  const isList = layoutMode === 'list';
  const isSquare = layoutMode === 'square';
  const isPlaque = layoutMode === 'honeycomb' && cardStyle === 'plaque';
  const plaqueNameLineHeight = isWindowsApp() ? '1.5' : undefined;
  const listColumns = useLibraryStore((state) => state.listColumns);
  const listMulti = isList && listColumns === 'multi';
  const layout = layoutForWidth(size.width, isSquare ? 'square' : layoutMode, zoom);
  // 铭牌需要两行文字，Windows 字体行高更大，防止蜂窝行距不足叠到下一行
  const textReserve = isPlaque ? (isWindowsApp() ? 68 : 52) : 0;
  const cellHeight = layout.card + textReserve;
  const rowSpacingY = layout.spacingY + textReserve;
  const clipRadius = Math.hypot(size.width, size.height) / 2 + Math.max(layout.card, cellHeight);
  const showSkeleton = isLoading && items.length === 0;
  const showRefreshOverlay = isLoading && items.length > 0;

  const coords = useMemo(() => {
    coordsRef.current = resizeHexGridCoords(coordsRef.current, items.length, layout.spacingX, rowSpacingY);
    return coordsRef.current;
  }, [items.length, layout.spacingX, rowSpacingY]);

  const panLimits = useMemo(
    () => computePanLimits(coords, layout.card, cellHeight, size.width, size.height),
    [coords, layout.card, cellHeight, size.width, size.height],
  );
  const panLimitsRef = useRef(panLimits);
  panLimitsRef.current = panLimits;

  const coordByKey = useMemo(() => {
    const map = new Map<string, number>();
    coords.forEach((coord) => map.set(toCubeKey(coord.cube), coord.index));
    return map;
  }, [coords]);

  const ringRadius = Math.ceil(clipRadius / Math.min(layout.spacingX, rowSpacingY)) + 2;

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
      clipRadius + layout.card + CARD_GAP * 2,
    );
    setVisible((prev) => (areIndexListsEqual(prev, next) ? prev : next));
  }, [clipRadius, coordByKey, coords, layout.card, layout.spacingX, rowSpacingY, ringRadius]);

  const paint = useCallback((dx: number, dy: number) => {
    const refs = cardRefs.current;
    for (let i = 0; i < refs.length; i += 1) {
      const el = refs[i];
      const coord = coords[i];
      if (el && coord) applyCardFrame(el, coord, dx, dy);
    }
  }, [applyCardFrame, coords]);

  const flushVisible = useCallback((dx: number, dy: number, force = false) => {
    const now = performance.now();
    const moved = Math.hypot(
      dx - lastVisibleOffsetRef.current.x,
      dy - lastVisibleOffsetRef.current.y,
    );
    const minMove = Math.max(24, Math.min(layout.spacingX, rowSpacingY) * 0.28);
    if (!force && now - lastVisibleAtRef.current < 90 && moved < minMove) return;
    lastVisibleAtRef.current = now;
    lastVisibleOffsetRef.current = { x: dx, y: dy };
    refreshVisible(dx, dy);
  }, [layout.spacingX, refreshVisible, rowSpacingY]);

  const scheduleFrame = useCallback((dx: number, dy: number, opts?: { forceVisible?: boolean }) => {
    pendingOffsetRef.current = { x: dx, y: dy };
    if (opts?.forceVisible) forceVisibleRef.current = true;
    if (rafPaintRef.current) return;
    rafPaintRef.current = window.requestAnimationFrame(() => {
      rafPaintRef.current = 0;
      const next = pendingOffsetRef.current;
      const forceVisible = forceVisibleRef.current;
      forceVisibleRef.current = false;
      paint(next.x, next.y);
      flushVisible(next.x, next.y, forceVisible);
    });
  }, [flushVisible, paint]);

  const cancelBounce = useCallback(() => {
    if (bounceRafRef.current) {
      window.cancelAnimationFrame(bounceRafRef.current);
      bounceRafRef.current = 0;
    }
  }, []);

  const applyPanOffset = useCallback((x: number, y: number, mode: 'drag' | 'wheel' | 'hard' = 'drag') => {
    const limits = panLimitsRef.current;
    let nextX = x;
    let nextY = y;
    if (mode === 'hard') {
      nextX = clampPan(x, limits.minX, limits.maxX);
      nextY = clampPan(y, limits.minY, limits.maxY);
    } else {
      nextX = rubberBand(x, limits.minX, limits.maxX);
      nextY = rubberBand(y, limits.minY, limits.maxY);
    }
    offsetRef.current = { x: nextX, y: nextY };
    scheduleFrame(nextX, nextY, mode === 'hard' ? { forceVisible: true } : undefined);
  }, [scheduleFrame]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      // home 切到播放器时会被 display:none，尺寸会变成 0；忽略以免清掉滚动/平移
      if (width < 8 || height < 8) return;
      setSize((prev) => (
        prev.width === width && prev.height === height ? prev : { width, height }
      ));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    if (rafPaintRef.current) {
      window.cancelAnimationFrame(rafPaintRef.current);
      rafPaintRef.current = 0;
    }
    if (bounceRafRef.current) {
      window.cancelAnimationFrame(bounceRafRef.current);
      bounceRafRef.current = 0;
    }
  }, []);

  const persistScroll = useCallback(() => {
    const key = scrollKeyRef.current;
    if (!key) return;
    if (isList || isSquare) {
      const top = containerRef.current?.scrollTop || 0;
      saveLibraryScroll(key, { kind: 'scroll', top });
      return;
    }
    saveLibraryScroll(key, {
      kind: 'pan',
      x: offsetRef.current.x,
      y: offsetRef.current.y,
      zoom,
    });
  }, [isList, isSquare, zoom]);

  const bounceToBounds = useCallback(() => {
    cancelBounce();
    const limits = panLimitsRef.current;
    const from = { ...offsetRef.current };
    const to = {
      x: clampPan(from.x, limits.minX, limits.maxX),
      y: clampPan(from.y, limits.minY, limits.maxY),
    };
    if (Math.hypot(to.x - from.x, to.y - from.y) < 0.5) {
      offsetRef.current = to;
      scheduleFrame(to.x, to.y, { forceVisible: true });
      return;
    }
    const started = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / PAN_BOUNCE_MS);
      const e = easeOutCubic(t);
      const x = from.x + (to.x - from.x) * e;
      const y = from.y + (to.y - from.y) * e;
      offsetRef.current = { x, y };
      scheduleFrame(x, y, t >= 1 ? { forceVisible: true } : undefined);
      if (t < 1) {
        bounceRafRef.current = window.requestAnimationFrame(step);
        return;
      }
      bounceRafRef.current = 0;
      offsetRef.current = to;
      persistScroll();
    };
    bounceRafRef.current = window.requestAnimationFrame(step);
  }, [cancelBounce, persistScroll, scheduleFrame]);

  useEffect(() => {
    if (isList || isSquare) return;
    // 尺寸尚未就绪时不要清零，避免从播放器返回时丢位置
    if (size.width < 8 || size.height < 8) return;

    const saved = scrollKey ? readLibraryScroll(scrollKey) : undefined;
    const needsRestore = Boolean(
      scrollKey
      && saved
      && saved.kind === 'pan'
      && restoredKeyRef.current !== scrollKey,
    );

    if (needsRestore && saved && saved.kind === 'pan') {
      const limits = panLimitsRef.current;
      const x = clampPan(saved.x, limits.minX, limits.maxX);
      const y = clampPan(saved.y, limits.minY, limits.maxY);
      offsetRef.current = { x, y };
      lastVisibleOffsetRef.current = { x, y };
      lastVisibleAtRef.current = 0;
      if (typeof saved.zoom === 'number' && Number.isFinite(saved.zoom)) {
        const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, saved.zoom));
        if (Math.abs(nextZoom - zoom) > 0.001) setZoom(nextZoom);
      }
      restoredKeyRef.current = scrollKey;
      refreshVisible(x, y);
      requestAnimationFrame(() => paint(x, y));
      return;
    }

    // 已初始化过本页：间距/缩放变化时只重绘，不清零
    if (restoredKeyRef.current === scrollKey) {
      refreshVisible(offsetRef.current.x, offsetRef.current.y);
      requestAnimationFrame(() => paint(offsetRef.current.x, offsetRef.current.y));
      return;
    }

    offsetRef.current = { x: 0, y: 0 };
    lastVisibleOffsetRef.current = { x: 0, y: 0 };
    lastVisibleAtRef.current = 0;
    restoredKeyRef.current = scrollKey;
    refreshVisible(0, 0);
    requestAnimationFrame(() => paint(0, 0));
  }, [
    items.length,
    layout.spacingX,
    rowSpacingY,
    layoutMode,
    paint,
    refreshVisible,
    isList,
    isSquare,
    isPlaque,
    zoom,
    size.width,
    size.height,
    scrollKey,
  ]);

  useEffect(() => {
    if (isList || isSquare) return;
    paint(offsetRef.current.x, offsetRef.current.y);
  }, [paint, visible, isList, isSquare]);

  // 列表/方形：挂载或曲目就绪后恢复 scrollTop（多帧重试，避开进场动画）
  useEffect(() => {
    if (!(isList || isSquare) || !scrollKey) return;
    if (isLoading && items.length === 0) return;
    const el = containerRef.current;
    if (!el) return;
    const saved = readLibraryScroll(scrollKey);
    if (!saved || saved.kind !== 'scroll') return;
    if (restoredKeyRef.current === scrollKey) return;
    const top = saved.top;
    let tries = 0;
    let raf = 0;
    let timer = 0;
    const apply = () => {
      el.scrollTop = top;
      tries += 1;
      if (Math.abs(el.scrollTop - top) < 4 || tries >= 12) {
        restoredKeyRef.current = scrollKey;
        return;
      }
      raf = requestAnimationFrame(apply);
    };
    apply();
    timer = window.setTimeout(apply, 320);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [isList, isSquare, scrollKey, items.length, isLoading]);

  // 卸载前落盘当前位置
  useEffect(() => () => {
    persistScroll();
  }, [persistScroll]);

  // 仅在同实例切换 scrollKey 时允许再次恢复；首挂不清空
  const prevScrollKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevScrollKeyRef.current !== null && prevScrollKeyRef.current !== scrollKey) {
      restoredKeyRef.current = '';
    }
    prevScrollKeyRef.current = scrollKey;
  }, [scrollKey]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isList || isSquare || event.button !== 0) return;
    cancelBounce();
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
    if (isList || isSquare || !dragRef.current.active) return;
    const dist = Math.hypot(event.clientX - dragRef.current.startX, event.clientY - dragRef.current.startY);
    dragRef.current.distance = dist;
    if (dist >= 8 && !dragRef.current.captured) {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current.captured = true;
    }
    if (!dragRef.current.captured) return;
    event.preventDefault();
    const dx = dragRef.current.originX + (event.clientX - dragRef.current.startX);
    const dy = dragRef.current.originY + (event.clientY - dragRef.current.startY);
    applyPanOffset(dx, dy, 'drag');
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
      bounceToBounds();
      persistScroll();
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
    bounceToBounds();
    persistScroll();
  };

  useEffect(() => {
    if (isList || isSquare) return;
    const element = containerRef.current;
    if (!element) return;
    let wheelBounceTimer = 0;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      cancelBounce();
      // 触控板捏合在 macOS 上表现为 ctrl+wheel；Cmd+滚轮也可缩放
      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-event.deltaY * 0.008);
        setZoom((prev) => {
          const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev * factor));
          return Math.abs(next - prev) < 0.001 ? prev : next;
        });
        return;
      }
      applyPanOffset(
        offsetRef.current.x - event.deltaX,
        offsetRef.current.y - event.deltaY,
        'wheel',
      );
      persistScroll();
      window.clearTimeout(wheelBounceTimer);
      wheelBounceTimer = window.setTimeout(() => {
        bounceToBounds();
      }, 90);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.clearTimeout(wheelBounceTimer);
      element.removeEventListener('wheel', onWheel);
    };
  }, [applyPanOffset, bounceToBounds, cancelBounce, isList, isSquare, persistScroll]);

  // åæ¢èçª/æ¹å½¢æ¶éç½®ç¼©æ¾ï¼é¿åé´è·éä¹±æ®ç
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
        style={{
          paddingBottom: hasFloatingPlayer ? 'var(--player-dock-safe)' : '1.5rem',
        }}
        onScroll={persistScroll}
      >
        <div
          className="mx-auto grid w-full gap-4 px-4 pt-1 pb-4 sm:gap-5 sm:px-6 md:gap-6 md:px-8"
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
                  style={{
                    ...libraryCardSurface(isDaylight, showPlaque),
                  }}
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
                    className="app-scroll-item group flex w-full flex-col overflow-hidden rounded-2xl p-2.5 text-left transition hover:brightness-110"
                    style={{
                      isolation: 'isolate',
                      contain: 'paint',
                      ...libraryCardSurface(isDaylight, showPlaque),
                    }}
                  >
                    <div
                      className="relative aspect-square w-full overflow-hidden rounded-xl"
                      style={{ backgroundColor: isDaylight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }}
                    >
                      <CoverArt src={item.coverUrl} lazy={false} flipOnLoad={false} />
                      {item.delisted ? <DelistedCoverBadge /> : null}
                      {!showPlaque ? (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3 pt-10 pb-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <div className="truncate text-xs font-semibold text-white">{item.name}</div>
                        </div>
                      ) : null}
                    </div>
                    {showPlaque ? (
                      <div className="min-w-0 px-0.5 pt-2.5 pb-0.5">
                        <div className="truncate text-[13px] font-semibold leading-snug tracking-tight" style={{ lineHeight: plaqueNameLineHeight }}>
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
            <RyanLoader size={52} label="åæ­¥ä¸­â¦" />
          </div>
        ) : null}
      </div>
    );
  }

  if (isList) {
    return (
      <div
        key={`library-list-${listColumns}`}
        ref={containerRef}
        className="app-scroll hide-scrollbar relative min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto"
        style={{
          paddingBottom: hasFloatingPlayer ? 'var(--player-dock-safe)' : '1.5rem',
        }}
        onScroll={persistScroll}
      >
        <div
          className={
            listMulti
              ? 'mx-auto grid w-full max-w-6xl grid-cols-1 gap-2 px-4 pt-1 pb-4 sm:grid-cols-2 sm:gap-3 md:px-8 xl:grid-cols-3'
              : 'mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 pt-1 pb-4 md:px-8'
          }
        >
          {showSkeleton
            ? Array.from({ length: listMulti ? 12 : 8 }, (_, index) => (
                <div
                  key={`sk-list-${index}`}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
                  style={{
                    ...libraryCardSurface(isDaylight, false),
                  }}
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
                  <div className={`${listMulti ? 'col-span-full' : ''} flex flex-col items-center justify-center gap-4 py-16 text-center`}>
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
                    className={`relative flex w-full min-w-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                      isDaylight ? 'hover:bg-black/6' : 'hover:bg-white/8'
                    }`}
                    style={{
                      position: 'relative',
                      transform: 'none',
                      opacity: 1,
                      left: 'auto',
                      top: 'auto',
                      ...libraryCardSurface(isDaylight, false),
                    }}
                  >
                    <div
                      className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl"
                      style={{ backgroundColor: isDaylight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }}
                    >
                      <CoverArt src={item.coverUrl} flipOnLoad={false} />
                      {item.delisted ? <DelistedCoverBadge /> : null}
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
      style={{
        paddingBottom: hasFloatingPlayer ? '5.5rem' : '1.5rem',
      }}
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
                    className={`group absolute top-1/2 left-1/2 overflow-hidden rounded-2xl border-0 outline-none ring-0 ${isPlaque ? 'flex flex-col p-2.5 hover:brightness-110' : ''}`}
                    style={{
                      width: layout.card,
                      height: cellHeight,
                      marginLeft: -layout.card / 2,
                      marginTop: -cellHeight / 2,
                      willChange: 'transform, opacity',
                      isolation: 'isolate',
                      contain: 'paint',
                      ...libraryCardSurface(isDaylight, isPlaque),
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
                      <CoverArt src={item.coverUrl} flipOnLoad={false} />
                      {item.delisted ? <DelistedCoverBadge /> : null}
                      {!isPlaque ? (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3 pt-10 pb-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                          <div className="truncate text-left text-xs font-semibold text-white">{item.name}</div>
                        </div>
                      ) : null}
                    </div>
                    {isPlaque ? (
                      <div className="min-w-0 shrink-0 px-0.5 pt-2 pb-0.5 text-left">
                        <div className="truncate text-[13px] font-semibold leading-snug tracking-tight" style={{ lineHeight: plaqueNameLineHeight }}>
                          {item.name}
                        </div>
                        {item.description ? (
                          <div className="mt-0.5 truncate text-[11px] leading-snug opacity-45">
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
          <RyanLoader size={52} label="åæ­¥ä¸­â¦" />
        </div>
      ) : null}
    </div>
  );
};
