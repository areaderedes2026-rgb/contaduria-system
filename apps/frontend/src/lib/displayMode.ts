/** true cuando la app corre instalada (PWA / iOS home screen). */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone =
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || iosStandalone;
}

export function hardReloadApp(options?: { clearCaches?: boolean }): void {
  const finish = () => window.location.reload();

  void (async () => {
    if (options?.clearCaches && 'caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {
        /* ignore */
      }
    }
    finish();
  })();
}
