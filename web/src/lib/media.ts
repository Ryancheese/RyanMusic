import { useEffect, useState } from 'react';

export const MOBILE_BREAKPOINT = 768;

export function isMobileViewport() {
  return typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  ));

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
}

export function useCoarsePointer() {
  return useMediaQuery('(pointer: coarse)');
}

export function isWindowsApp() {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.classList.contains('platform-windows-app')) return true;
  return Boolean(window.chrome?.webview);
}

export function isMacosApp() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('platform-macos-app');
}

export function isNativeApp() {
  return isWindowsApp() || isMacosApp();
}

export function prefersLightweightVisualizer() {
  if (typeof window === 'undefined') return false;
  if (isWindowsApp()) return true;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof memory === 'number' && memory > 0 && memory <= 4;
}
