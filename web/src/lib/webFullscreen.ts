import { useCallback, useEffect, useState } from 'react';
import { isMacosApp, isWindowsApp } from './media';

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

export function isWebBrowser() {
  return typeof document !== 'undefined' && !isWindowsApp() && !isMacosApp();
}

export function isWebFullscreenSupported() {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement as FullscreenElement;
  return Boolean(
    root.requestFullscreen
    || root.webkitRequestFullscreen,
  );
}

function activeFullscreenElement(doc: FullscreenDocument = document) {
  return doc.fullscreenElement || doc.webkitFullscreenElement || null;
}

export async function enterWebFullscreen() {
  const root = document.documentElement as FullscreenElement;
  if (root.requestFullscreen) {
    await root.requestFullscreen();
    return;
  }
  await root.webkitRequestFullscreen?.();
}

export async function exitWebFullscreen() {
  const doc = document as FullscreenDocument;
  if (doc.exitFullscreen) {
    await doc.exitFullscreen();
    return;
  }
  await doc.webkitExitFullscreen?.();
}

export async function toggleWebFullscreen() {
  if (activeFullscreenElement()) {
    await exitWebFullscreen();
    return;
  }
  await enterWebFullscreen();
}

export function useWebFullscreen() {
  const [active, setActive] = useState(() => Boolean(activeFullscreenElement()));
  const supported = isWebFullscreenSupported();

  useEffect(() => {
    const sync = () => setActive(Boolean(activeFullscreenElement()));
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync as EventListener);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync as EventListener);
    };
  }, []);

  const toggle = useCallback(async () => {
    try {
      await toggleWebFullscreen();
    } catch {
      // iOS / 部分浏览器需用户手势且可能拒绝非视频全屏
    }
  }, []);

  return { active, supported, toggle };
}
