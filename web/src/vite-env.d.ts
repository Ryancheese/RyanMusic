/// <reference types="vite/client" />

interface Window {
  webkit?: {
    messageHandlers?: {
      ryanSave?: {
        postMessage: (payload: { url?: string; text?: string; filename: string }) => void;
      };
    };
  };
}
