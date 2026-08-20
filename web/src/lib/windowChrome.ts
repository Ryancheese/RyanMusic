export type WindowChromeAction =
  | 'drag'
  | 'minimize'
  | 'toggleMaximize'
  | 'close'
  | 'toggleFullscreen'
  | 'resizeLeft'
  | 'resizeRight'
  | 'resizeTop'
  | 'resizeBottom'
  | 'resizeTopLeft'
  | 'resizeTopRight'
  | 'resizeBottomLeft'
  | 'resizeBottomRight';

export interface NativeWindowState {
  maximized: boolean;
  fullscreen: boolean;
}

type ChromeHost = {
  postMessage: (payload: unknown) => void;
  addEventListener?: (type: string, handler: (event: { data: unknown }) => void) => void;
  removeEventListener?: (type: string, handler: (event: { data: unknown }) => void) => void;
};

function webview(): ChromeHost | undefined {
  return window.chrome?.webview as ChromeHost | undefined;
}

export function postWindowChrome(action: WindowChromeAction) {
  try {
    webview()?.postMessage({ action });
  } catch {
    // 非 WebView2 环境忽略
  }
}

export function readNativeWindowState(): NativeWindowState {
  const raw = (window as Window & { __ryanWindowState?: NativeWindowState }).__ryanWindowState;
  return {
    maximized: Boolean(raw?.maximized),
    fullscreen: Boolean(raw?.fullscreen),
  };
}

export function subscribeNativeWindowState(onChange: (state: NativeWindowState) => void) {
  const apply = (data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const payload = data as { type?: string; maximized?: boolean; fullscreen?: boolean };
    if (payload.type !== 'windowState') return;
    const next = {
      maximized: Boolean(payload.maximized),
      fullscreen: Boolean(payload.fullscreen),
    };
    (window as Window & { __ryanWindowState?: NativeWindowState }).__ryanWindowState = next;
    onChange(next);
  };

  const onWebMessage = (event: { data: unknown }) => apply(event.data);
  const onCustom = (event: Event) => apply((event as CustomEvent).detail);
  const host = webview();
  host?.addEventListener?.('message', onWebMessage);
  window.addEventListener('ryan-window-state', onCustom);
  onChange(readNativeWindowState());
  return () => {
    host?.removeEventListener?.('message', onWebMessage);
    window.removeEventListener('ryan-window-state', onCustom);
  };
}
