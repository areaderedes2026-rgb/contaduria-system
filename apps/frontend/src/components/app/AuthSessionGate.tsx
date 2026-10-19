import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { getMe } from '@/services/auth.service';
import { ApiClientError, pingApi } from '@/services/api';
import { forceLogout } from '@/lib/session';
import { hardReloadApp } from '@/lib/displayMode';
import { BootScreen } from '@/components/app/BootScreen';

const HYDRATE_FALLBACK_MS = 2000;
const ME_TIMEOUT_MS = 10_000;
const RETRY_MS = 2500;

type GatePhase = 'hydrating' | 'validating' | 'waiting-server' | 'ready';

function dismissHtmlSplash(): void {
  try {
    window.__CONTADURIA_BOOTED__ = true;
    window.__contaduriaDismissBootSplash?.();
  } catch {
    /* ignore */
  }
}

async function getMeWithTimeout(ms: number) {
  let timer: number | undefined;
  try {
    return await Promise.race([
      getMe(),
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => {
          reject(new ApiClientError('Tiempo de espera agotado', 0, 'NETWORK_ERROR'));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}

/**
 * 1) Espera rehidratación de localStorage
 * 2) Si hay token, valida /auth/me antes de mostrar la app
 * 3) Si el servidor aún no responde (PC recién encendida), espera con feedback
 * 4) Si el token expiró, redirige a login con mensaje claro
 */
export function AuthSessionGate({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const setUser = useAuthStore((s) => s.setUser);
  const [phase, setPhase] = useState<GatePhase>('hydrating');
  const [attempt, setAttempt] = useState(0);
  const cancelledRef = useRef(false);
  const validatingRef = useRef(false);

  useEffect(() => {
    if (hasHydrated) return;
    const t = window.setTimeout(() => {
      useAuthStore.getState().setHasHydrated(true);
    }, HYDRATE_FALLBACK_MS);
    return () => window.clearTimeout(t);
  }, [hasHydrated]);

  const validateSession = useCallback(async () => {
    if (validatingRef.current) return;
    validatingRef.current = true;

    const currentToken = useAuthStore.getState().token;
    if (!currentToken) {
      setPhase('ready');
      dismissHtmlSplash();
      validatingRef.current = false;
      return;
    }

    setPhase((prev) => (prev === 'waiting-server' ? 'waiting-server' : 'validating'));

    try {
      const user = await getMeWithTimeout(ME_TIMEOUT_MS);
      if (cancelledRef.current) return;
      setUser(user);
      setPhase('ready');
      dismissHtmlSplash();
    } catch (err: unknown) {
      if (cancelledRef.current) return;

      const unauthorized =
        err instanceof ApiClientError &&
        (err.statusCode === 401 ||
          err.code === 'INVALID_TOKEN' ||
          err.code === 'NO_TOKEN');

      if (unauthorized) {
        forceLogout('expired');
        return;
      }

      // Red / timeout / backend caído: esperar con UI (no echar al usuario)
      setPhase('waiting-server');
      dismissHtmlSplash();
    } finally {
      validatingRef.current = false;
    }
  }, [setUser]);

  useEffect(() => {
    if (!hasHydrated) {
      setPhase('hydrating');
      return;
    }

    cancelledRef.current = false;
    void validateSession();

    return () => {
      cancelledRef.current = true;
      validatingRef.current = false;
    };
  }, [hasHydrated, token, attempt, validateSession]);

  // Reintento automático mientras el servidor no responde
  useEffect(() => {
    if (phase !== 'waiting-server') return;

    const tick = window.setInterval(() => {
      void (async () => {
        const online = await pingApi();
        if (online && !cancelledRef.current) {
          setAttempt((n) => n + 1);
        }
      })();
    }, RETRY_MS);

    return () => window.clearInterval(tick);
  }, [phase]);

  // Sin token: listo apenas hidrata
  useEffect(() => {
    if (hasHydrated && !token) {
      setPhase('ready');
      dismissHtmlSplash();
    }
  }, [hasHydrated, token]);

  if (phase === 'hydrating') {
    return <BootScreen message="Cargando sesión…" hint="Preparando el sistema" />;
  }

  if (phase === 'validating') {
    return (
      <BootScreen
        message="Verificando sesión…"
        hint="Comprobando que su acceso siga vigente"
      />
    );
  }

  if (phase === 'waiting-server') {
    return (
      <BootScreen
        message="Conectando con el servidor…"
        hint="Tras encender la PC, Docker o la API pueden tardar unos segundos. La sesión se mantiene."
        onRetry={() => setAttempt((n) => n + 1)}
        onReload={hardReloadApp}
        retryLabel="Reintentar ahora"
      />
    );
  }

  return children;
}

declare global {
  interface Window {
    __CONTADURIA_BOOTED__?: boolean;
    __contaduriaDismissBootSplash?: () => void;
  }
}
