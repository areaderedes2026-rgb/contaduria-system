import { isChunkLoadError, notifyRecoveryNeeded } from '@/utils/chunkError';

let listenersAttached = false;

export function attachAppRecoveryListeners(): void {
  if (listenersAttached || typeof window === 'undefined') return;
  listenersAttached = true;

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    notifyRecoveryNeeded('chunk');
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      event.preventDefault();
      notifyRecoveryNeeded('chunk');
    }
  });

  window.addEventListener('error', (event) => {
    if (isChunkLoadError(event.error ?? event.message)) {
      notifyRecoveryNeeded('chunk');
    }
  });

  window.addEventListener('online', () => {
    // Tras recuperar conexión, verificar si hay SW pendiente
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => reg.update()).catch(() => undefined);
    }
  });
}
