import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WifiOff, RefreshCw } from 'lucide-react';
import { pingApi } from '@/services/api';
import { Button } from '@/components/ui/Button';

const POLL_MS = 4000;

/**
 * Avisa cuando el backend no responde (típico tras reiniciar la PC
 * antes de que levante Docker/API) y reintenta automáticamente.
 */
export function ApiConnectionBanner() {
  const queryClient = useQueryClient();
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);
  const wasOffline = useRef(false);

  const check = useCallback(async () => {
    setChecking(true);
    const ok = await pingApi();
    setChecking(false);

    if (ok) {
      if (wasOffline.current) {
        await queryClient.invalidateQueries();
      }
      wasOffline.current = false;
      setOffline(false);
      return true;
    }

    wasOffline.current = true;
    setOffline(true);
    return false;
  }, [queryClient]);

  useEffect(() => {
    void check();

    const onOnline = () => {
      void check();
    };
    const onFocus = () => {
      void check();
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void check();
      }
    }, offline ? POLL_MS : 30_000);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
    };
  }, [check, offline]);

  if (!offline) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[110] border-b border-amber-300 bg-amber-50 px-4 py-2.5 shadow-sm"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
        <div className="flex items-start gap-2 text-sm text-amber-950">
          <WifiOff size={18} className="mt-0.5 shrink-0 text-amber-700" />
          <div>
            <p className="font-semibold">Sin conexión con el servidor</p>
            <p className="text-xs text-amber-900/90">
              El sistema está iniciando o la API no responde. Los datos aparecerán solos cuando
              el backend esté listo (no hace falta cerrar sesión).
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={checking}
          onClick={() => void check()}
        >
          <RefreshCw size={14} />
          Reintentar
        </Button>
      </div>
    </div>
  );
}
