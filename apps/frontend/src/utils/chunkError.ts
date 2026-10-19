export type RecoveryReason = 'update' | 'chunk' | 'crash' | 'offline';

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes('failed to fetch dynamically imported module') ||
    normalized.includes('importing a module script failed') ||
    normalized.includes('error loading dynamically imported module') ||
    normalized.includes('loading chunk') ||
    normalized.includes('chunkloaderror') ||
    normalized.includes('unable to preload css')
  );
}

export const APP_RECOVERY_EVENT = 'contaduria:recovery-needed';

export function notifyRecoveryNeeded(reason: RecoveryReason): void {
  window.dispatchEvent(
    new CustomEvent(APP_RECOVERY_EVENT, { detail: { reason } })
  );
}

export async function clearAppCaches(): Promise<void> {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
}

export function hardReload(options?: { clearCaches?: boolean }): void {
  const finish = () => {
    window.location.reload();
  };

  const run = async () => {
    if (options?.clearCaches) {
      await clearAppCaches();
    }

    if (!('serviceWorker' in navigator)) {
      finish();
      return;
    }

    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update()));
    } catch {
      /* ignore */
    } finally {
      finish();
    }
  };

  void run();
}
