import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import {
  APP_RECOVERY_EVENT,
  hardReload,
  type RecoveryReason,
} from '@/utils/chunkError';
import {
  getAppVersion,
  versionFingerprint,
  type AppVersionInfo,
} from '@/services/version.service';
import { AppRecoveryPanel } from './AppRecoveryPanel';

const CHECK_MS = 2 * 60 * 1000;

export function AppRecoveryBanner() {
  const [reason, setReason] = useState<RecoveryReason | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [reloading, setReloading] = useState(false);
  const baselineRef = useRef<string | null>(null);

  const sw = useRegisterSW({
    immediate: true,
    onRegisterError(error) {
      console.warn('Service Worker no registrado:', error);
    },
  });

  const needRefresh = Boolean(sw.needRefresh?.[0]);
  const updateServiceWorker = sw.updateServiceWorker;

  const markUpdateAvailable = useCallback(() => {
    if (!dismissed) {
      setReason('update');
    }
  }, [dismissed]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const checkUpdate = () => {
      navigator.serviceWorker.ready.then((reg) => reg.update()).catch(() => undefined);
    };

    checkUpdate();
    const interval = window.setInterval(checkUpdate, CHECK_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') checkUpdate();
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', checkUpdate);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', checkUpdate);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const checkServerVersion = async () => {
      try {
        const info: AppVersionInfo = await getAppVersion();
        if (cancelled) return;
        const fingerprint = versionFingerprint(info);
        if (baselineRef.current == null) {
          baselineRef.current = fingerprint;
          return;
        }
        if (fingerprint !== baselineRef.current) {
          markUpdateAvailable();
        }
      } catch {
        // Silencioso: la PC puede estar arrancando o sin red momentánea
      }
    };

    void checkServerVersion();
    const interval = window.setInterval(() => {
      void checkServerVersion();
    }, CHECK_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkServerVersion();
    };
    const onFocus = () => {
      void checkServerVersion();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [markUpdateAvailable]);

  useEffect(() => {
    if (needRefresh && !dismissed) {
      setReason('update');
    }
  }, [needRefresh, dismissed]);

  useEffect(() => {
    const onRecovery = (event: Event) => {
      const custom = event as CustomEvent<{ reason: RecoveryReason }>;
      setReason(custom.detail?.reason ?? 'chunk');
      setDismissed(false);
    };

    window.addEventListener(APP_RECOVERY_EVENT, onRecovery);
    return () => window.removeEventListener(APP_RECOVERY_EVENT, onRecovery);
  }, []);

  const handleReload = useCallback(
    async (opts?: { clearCaches?: boolean }) => {
      setReloading(true);
      try {
        if (needRefresh) {
          await updateServiceWorker(true);
          return;
        }
        hardReload({ clearCaches: opts?.clearCaches });
      } catch {
        hardReload({ clearCaches: true });
      }
    },
    [needRefresh, updateServiceWorker]
  );

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    if (reason === 'update') setReason(null);
  }, [reason]);

  if (!reason || dismissed) return null;

  const canDismiss = reason === 'update';

  return (
    <AppRecoveryPanel
      reason={reason}
      variant="banner"
      onReload={handleReload}
      onDismiss={canDismiss ? handleDismiss : undefined}
      reloading={reloading}
    />
  );
}
