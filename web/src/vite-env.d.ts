/// <reference types="vite/client" />

interface Window {
  __ryanUpdateResolve?: (payload: import('./lib/update').AppUpdateInfo) => void;
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
