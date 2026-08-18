/// <reference types="vite/client" />

interface Window {
  chrome?: {
    webview?: {
      postMessage: (payload: unknown) => void;
    };
  };
  __ryanUpdateResolve?: (payload: import('./lib/update').AppUpdateInfo) => void;
  __ryanUpdateProgress?: (payload: import('./lib/update').AppUpdateProgress) => void;
  webkit?: {
    messageHandlers?: {
      ryanSave?: {
        postMessage: (payload: { url?: string; text?: string; filename: string }) => void;
      };
      ryanUpdate?: {
        postMessage: (payload: { action: 'check' | 'install' }) => void;
      };
      ryanChrome?: {
        postMessage: (payload: { daylight: boolean }) => void;
      };
    };
  };
}
