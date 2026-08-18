import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { type MotionValue, useMotionValueEvent } from 'framer-motion';

interface ProgressBarProps {
  currentTime: MotionValue<number>;
  duration: number;
  onSeek: (time: number) => void;
  primaryColor?: string;
  secondaryColor?: string;
  trackColor?: string;
  disabled?: boolean;
}

const formatTime = (time: number) => {
  if (!Number.isFinite(time) || time < 0) return '00:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const ProgressBar: React.FC<ProgressBarProps> = ({
  currentTime,
  duration,
  onSeek,
  primaryColor = 'white',
  secondaryColor = 'rgba(255,255,255,0.5)',
  trackColor = 'rgba(255,255,255,0.1)',
  disabled = false,
}) => {
  const progressRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDraggingRef = useRef(false);
  const lastDisplayedSecondRef = useRef<number | null>(null);

  const updateUI = useCallback(
    (value: number, force = false, bypassDrag = false) => {
      if (!bypassDrag && isDraggingRef.current) return;
      const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
      const clampedValue = duration > 0 ? Math.min(safeValue, duration) : safeValue;
      const displayedSecond = Math.floor(clampedValue);

      if (progressRef.current) {
        const progress = duration > 0 ? Math.min(1, clampedValue / duration) : 0;
        progressRef.current.style.clipPath = `inset(0 ${((1 - progress) * 100).toFixed(4)}% 0 0 round 999px)`;
      }

      if (timeRef.current && (force || lastDisplayedSecondRef.current !== displayedSecond)) {
        timeRef.current.textContent = formatTime(clampedValue);
        lastDisplayedSecondRef.current = displayedSecond;
      }

      if (inputRef.current && (force || Number(inputRef.current.value) !== clampedValue)) {
        inputRef.current.value = clampedValue.toString();
      }
    },
    [duration],
  );

  const finishDragging = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const value = Number(inputRef.current?.value || 0);
    updateUI(value, true, true);
    onSeek(value);
  }, [onSeek, updateUI]);

  useEffect(() => {
    const finish = () => finishDragging();
    window.addEventListener('pointerup', finish, true);
    window.addEventListener('pointercancel', finish, true);
    window.addEventListener('blur', finish);
    return () => {
      window.removeEventListener('pointerup', finish, true);
      window.removeEventListener('pointercancel', finish, true);
      window.removeEventListener('blur', finish);
    };
  }, [finishDragging]);

  useLayoutEffect(() => {
    updateUI(currentTime.get(), true);
  }, [currentTime, updateUI]);

  useMotionValueEvent(currentTime, 'change', (latest: number) => {
    updateUI(latest);
  });

  return (
    <div className="flex w-full select-none items-center gap-3">
      <span
        ref={timeRef}
        className="w-8 text-right font-mono text-[10px] font-medium opacity-60"
        style={{ color: secondaryColor }}
      >
        00:00
      </span>
      <div
        className={`group relative flex h-8 flex-1 items-center ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        }`}
      >
        <div className="relative h-1.5 w-full rounded-full" style={{ backgroundColor: trackColor }}>
          <div
            ref={progressRef}
            className="pointer-events-none absolute top-0 left-0 h-full w-full rounded-full"
            style={{
              backgroundColor: primaryColor,
              clipPath: 'inset(0 100% 0 0 round 999px)',
              willChange: 'clip-path',
            }}
          />
        </div>
        <input
          ref={inputRef}
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          disabled={disabled}
          defaultValue={0}
          onPointerDown={(event) => {
            if (disabled) return;
            isDraggingRef.current = true;
            event.stopPropagation();
          }}
          onPointerMove={(event) => {
            if (isDraggingRef.current && event.buttons === 0) finishDragging();
          }}
          onPointerUp={finishDragging}
          onPointerCancel={finishDragging}
          onInput={(event) => {
            if (disabled) return;
            const value = Number(event.currentTarget.value);
            updateUI(value, false, true);
            if (!isDraggingRef.current) onSeek(value);
          }}
          onClick={(event) => event.stopPropagation()}
          className={`absolute inset-0 h-full w-full opacity-0 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        />
      </div>
      <span className="w-8 font-mono text-[10px] font-medium opacity-60" style={{ color: secondaryColor }}>
        {formatTime(duration)}
      </span>
    </div>
  );
};

export default ProgressBar;
