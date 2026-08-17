import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Disc } from 'lucide-react';

export interface Grid3DSliderItem {
  id: string;
  name: string;
  coverUrl?: string;
  description?: string;
}

interface Grid3DSliderProps {
  items: Grid3DSliderItem[];
  focusedIndex: number;
  onFocusedIndexChange: (index: number) => void;
  onSelect: (item: Grid3DSliderItem, index: number) => void;
  isDaylight: boolean;
  isLoading?: boolean;
  emptyMessage?: string;
  hasFloatingPlayer?: boolean;
}

const CARD_GAP_DESKTOP = 48;
const CARD_GAP_MOBILE = 20;

export const Grid3DSlider: React.FC<Grid3DSliderProps> = ({
  items,
  focusedIndex,
  onFocusedIndexChange,
  onSelect,
  isDaylight,
  isLoading = false,
  emptyMessage = '还没有内容',
  hasFloatingPlayer = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0, distance: 0 });
  const [size, setSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  }));

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const compact = size.width > 0 && (size.width < 768 || size.height < 520);
  const coverSize = compact ? 148 : size.width >= 1440 ? 312 : 218;
  const cardGap = compact ? CARD_GAP_MOBILE : CARD_GAP_DESKTOP;
  const edgePadding = Math.max(0, (size.width - coverSize) / 2);
  const pitch = coverSize + cardGap;
  const safeIndex = items.length ? Math.min(Math.max(0, focusedIndex), items.length - 1) : 0;

  const updateTransforms = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return 0;
    const cards = container.querySelectorAll<HTMLElement>('[data-grid3d-index]');
    const center = container.scrollLeft + container.clientWidth / 2;
    const closest = items.length
      ? Math.min(Math.max(0, Math.round((center - edgePadding - coverSize / 2) / pitch)), items.length - 1)
      : 0;
    cards.forEach((el) => {
      const index = Number(el.dataset.grid3dIndex);
      const cardCenter = edgePadding + index * pitch + coverSize / 2;
      const tValue = Math.min(Math.abs(cardCenter - center) / 600, 1);
      el.style.transform = `scale(${1.22 - 0.72 * tValue}) translateY(${-6 * (1 - tValue)}px)`;
      el.style.opacity = String(Math.max(0.15, 1 - 0.85 * tValue));
      el.style.zIndex = String(Math.max(1, Math.round(10 - 9 * tValue)));
    });
    return closest;
  }, [coverSize, edgePadding, items.length, pitch]);

  const centerIndex = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      const container = scrollRef.current;
      if (!container || index < 0) return;
      container.scrollTo({
        left: edgePadding + index * pitch + coverSize / 2 - container.clientWidth / 2,
        behavior,
      });
    },
    [coverSize, edgePadding, pitch],
  );

  useEffect(() => {
    requestAnimationFrame(() => {
      centerIndex(safeIndex, 'auto');
      updateTransforms();
    });
  }, [centerIndex, items.length, safeIndex, size.width, updateTransforms]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onWheel = (event: WheelEvent) => {
      if (window.matchMedia('(pointer: coarse)').matches) return;
      event.preventDefault();
      container.scrollLeft += event.deltaY + event.deltaX;
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  const focused = items[safeIndex];

  const skeletons = useMemo(() => Array.from({ length: 5 }, (_, index) => index), []);

  return (
    <div ref={containerRef} className="relative flex min-h-0 w-full flex-1 flex-col justify-center select-none">
      <div
        ref={scrollRef}
        className={`custom-scrollbar hide-scrollbar flex w-full cursor-grab items-center overflow-x-auto overflow-y-hidden touch-pan-x active:cursor-grabbing ${
          compact ? 'py-12' : 'py-24'
        }`}
        onScroll={() => {
          const closest = updateTransforms();
          if (closest !== focusedIndex) onFocusedIndexChange(closest);
        }}
        onMouseDown={(event) => {
          if (!scrollRef.current || event.button !== 0) return;
          if (window.matchMedia('(pointer: coarse)').matches) return;
          dragRef.current = {
            active: true,
            startX: event.pageX,
            scrollLeft: scrollRef.current.scrollLeft,
            distance: 0,
          };
        }}
        onMouseMove={(event) => {
          if (!dragRef.current.active || !scrollRef.current) return;
          const walk = (event.pageX - dragRef.current.startX) * 1.5;
          dragRef.current.distance = Math.abs(walk);
          scrollRef.current.scrollLeft = dragRef.current.scrollLeft - walk;
        }}
        onMouseUp={() => {
          dragRef.current.active = false;
        }}
        onMouseLeave={() => {
          dragRef.current.active = false;
        }}
      >
        <div className="flex" style={{ paddingInline: edgePadding }}>
          {isLoading
            ? skeletons.map((index) => (
                <div
                  key={`sk-${index}`}
                  className="shrink-0"
                  style={{ marginRight: index < 4 ? cardGap : 0, width: coverSize }}
                >
                  <div className={`aspect-square animate-pulse rounded-xl border border-white/5 ${isDaylight ? 'bg-zinc-200/20' : 'bg-zinc-800/20'}`} />
                </div>
              ))
            : items.length === 0
              ? (
                  <div className="flex w-full min-w-[min(20rem,100%)] shrink-0 items-center justify-center px-8 text-center text-sm opacity-40">
                    {emptyMessage}
                  </div>
                )
              : items.map((item, index) => (
                  <div
                    key={item.id}
                    data-grid3d-index={index}
                    className="shrink-0 cursor-pointer select-none"
                    style={{ marginRight: index < items.length - 1 ? cardGap : 0 }}
                    onClick={() => {
                      if (dragRef.current.distance >= 8) return;
                      if (index === safeIndex) onSelect(item, index);
                      else {
                        onFocusedIndexChange(index);
                        centerIndex(index);
                      }
                    }}
                  >
                    <div
                      className={`flex flex-col items-center rounded-xl border shadow-lg backdrop-blur-md theme-polaroid-card hover:shadow-2xl ${
                        compact ? 'p-2.5' : 'p-4'
                      }`}
                      style={{ width: coverSize }}
                    >
                      <div className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-zinc-800/20 shadow-inner ${compact ? 'mb-2' : 'mb-4'}`}>
                        {item.coverUrl ? (
                          <img
                            src={item.coverUrl}
                            alt={item.name}
                            className="h-full w-full object-cover select-none"
                            draggable={false}
                          />
                        ) : (
                          <Disc size={compact ? 40 : 64} className="opacity-20" />
                        )}
                      </div>
                      <div className="w-full min-w-0 pt-2 text-left">
                        <h3 className="truncate text-sm font-bold tracking-tight">{item.name}</h3>
                        {item.description && (
                          <p className="mt-1 truncate text-xs font-medium opacity-50">{item.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
        </div>
      </div>
      {!isLoading && focused && (
        <div
          className={`pointer-events-none relative z-10 shrink-0 px-6 text-center md:px-8 ${
            hasFloatingPlayer
              ? 'pt-4 pb-24 md:pt-8 md:pb-0 md:-mb-6'
              : 'pt-4 pb-8 md:pt-6 md:pb-4'
          }`}
        >
          <h3 className="mx-auto max-w-xl truncate text-lg font-bold md:text-2xl" style={{ color: 'var(--text-primary)' }}>
            {focused.name}
          </h3>
          <p className="mt-1 font-mono text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>
            {focused.description}
          </p>
        </div>
      )}
    </div>
  );
};
