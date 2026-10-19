/**
 * Gestión centralizada de cierre de sesión forzado
 * (p. ej. token expirado / 401), sin depender del ciclo de React.
 */

export const AUTH_REQUIRED_EVENT = 'contaduria:auth-required';
export const AUTH_MSG_KEY = 'contaduria-auth-msg';

export type AuthLogoutReason = 'unauthorized' | 'expired' | 'manual';

let redirecting = false;

function clearPersistedAuth(): void {
  try {
    const raw = localStorage.getItem('contaduria-auth');
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
      if (parsed?.state) {
        parsed.state.token = null;
        parsed.state.user = null;
        localStorage.setItem('contaduria-auth', JSON.stringify(parsed));
      } else {
        localStorage.removeItem('contaduria-auth');
      }
    }
  } catch {
    localStorage.removeItem('contaduria-auth');
  }
}

/** Guarda un mensaje para mostrar en /login tras el redirect. */
export function setAuthLoginMessage(reason: AuthLogoutReason): void {
  try {
    if (reason === 'unauthorized' || reason === 'expired') {
      sessionStorage.setItem(AUTH_MSG_KEY, 'expired');
    }
  } catch {
    /* ignore */
  }
}

export function consumeAuthLoginMessage(): string | null {
  try {
    const value = sessionStorage.getItem(AUTH_MSG_KEY);
    if (value) sessionStorage.removeItem(AUTH_MSG_KEY);
    return value;
  } catch {
    return null;
  }
}

export function forceLogout(reason: AuthLogoutReason = 'unauthorized'): void {
  clearPersistedAuth();

  if (reason === 'unauthorized' || reason === 'expired') {
    setAuthLoginMessage(reason);
  }

  window.dispatchEvent(
    new CustomEvent(AUTH_REQUIRED_EVENT, { detail: { reason } })
  );

  if ((reason === 'unauthorized' || reason === 'expired') && !redirecting) {
    const path = window.location.pathname;
    if (path !== '/login' && !path.startsWith('/login')) {
      redirecting = true;
      // Full navigation: limpia React Query y evita UI a medias con token muerto
      window.location.assign('/login?reason=expired');
    }
  }
}

/** Permite nuevos redirects tras un login exitoso en la misma pestaña. */
export function resetLogoutRedirectLock(): void {
  redirecting = false;
}
