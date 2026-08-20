import React, { useEffect, useState } from 'react';
import { Copy, Maximize2, Minimize2, Minus, Square, X } from 'lucide-react';
import { isWindowsApp } from '../lib/media';
import { postWindowChrome, subscribeNativeWindowState } from '../lib/windowChrome';

interface WindowControlsProps {
  isDaylight: boolean;
  /** 歌词舞台才隐藏，首页始终露出按钮 */
  autoHide?: boolean;
}

const WindowControls: React.FC<WindowControlsProps> = ({ isDaylight, autoHide = false }) => {
  const [enabled, setEnabled] = useState(() => isWindowsApp());
  const [hovering, setHovering] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    setEnabled(isWindowsApp());
  }, []);

  useEffect(() => {
    if (!enabled) return;
    return subscribeNativeWindowState((state) => {
      setMaximized(state.maximized);
      setFullscreen(state.fullscreen);
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !autoHide) return;
    let hideTimer: number | undefined;
    const onMove = (event: MouseEvent) => {
      const inStrip = event.clientY <= 52 || (event.clientY <= 48 && event.clientX >= window.innerWidth - 190);
      if (inStrip) {
        if (hideTimer) window.clearTimeout(hideTimer);
        setHovering(true);
        return;
      }
      hideTimer = window.setTimeout(() => setHovering(false), 280);
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [autoHide, enabled]);

  if (!enabled) return null;

  const revealed = !autoHide || hovering;
  const tone = isDaylight
    ? 'hover:bg-black/[0.08] text-stone-700'
    : 'hover:bg-white/10 text-white/85';
  const visible = revealed
    ? 'pointer-events-auto opacity-100 translate-y-0'
    : 'pointer-events-none opacity-0 -translate-y-1';
  const btn = `flex h-full w-11 items-center justify-center transition-all duration-200 ${visible} ${tone}`;

  return (
    <div className="titlebar-no-drag fixed top-0 right-0 z-[100] flex h-10">
      <button
        type="button"
        className={btn}
        title="最小化"
        aria-label="最小化"
        onClick={() => postWindowChrome('minimize')}
      >
        <Minus size={15} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className={btn}
        title={maximized ? '还原' : '最大化'}
        aria-label={maximized ? '还原' : '最大化'}
        onClick={() => postWindowChrome('toggleMaximize')}
      >
        {maximized || fullscreen ? <Copy size={13} strokeWidth={1.8} /> : <Square size={13} strokeWidth={1.8} />}
      </button>
      <button
        type="button"
        className={btn}
        title={fullscreen ? '退出全屏' : '全屏'}
        aria-label={fullscreen ? '退出全屏' : '全屏'}
        onClick={() => postWindowChrome('toggleFullscreen')}
      >
        {fullscreen ? <Minimize2 size={14} strokeWidth={1.8} /> : <Maximize2 size={14} strokeWidth={1.8} />}
      </button>
      <button
        type="button"
        className={`flex h-full w-11 items-center justify-center transition-all duration-200 hover:bg-red-500 hover:text-white ${visible} ${
          isDaylight ? 'text-stone-700' : 'text-white/85'
        }`}
        title="关闭"
        aria-label="关闭"
        onClick={() => postWindowChrome('close')}
      >
        <X size={15} strokeWidth={1.8} />
      </button>
    </div>
  );
};

export default WindowControls;
