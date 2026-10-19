import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRoutes } from '@/routes';
import { AppErrorBoundary } from '@/components/app/AppErrorBoundary';
import { AppRecoveryBanner } from '@/components/app/AppRecoveryBanner';
import { AuthSessionGate } from '@/components/app/AuthSessionGate';
import { ApiConnectionBanner } from '@/components/app/ApiConnectionBanner';
import { PwaReloadButton } from '@/components/app/PwaReloadButton';
import { attachAppRecoveryListeners } from '@/lib/appRecoveryListeners';
import { bootstrapPwaInstall } from '@/lib/pwaInstall';
import { ApiClientError } from '@/services/api';
import './index.css';

declare global {
  interface Window {
    __CONTADURIA_BOOTED__?: boolean;
    __contaduriaDismissBootSplash?: () => void;
  }
}

attachAppRecoveryListeners();
bootstrapPwaInstall();

// Marca que el entry cargó (el splash HTML espera esto / el gate lo completa)
window.__CONTADURIA_BOOTED__ = true;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Tras reiniciar la PC el backend puede tardar: reintentar errores de red
      retry: (failureCount, error) => {
        if (error instanceof ApiClientError) {
          if (error.statusCode === 401) return false;
          if (error.code === 'NETWORK_ERROR' || error.code === 'INVALID_RESPONSE') {
            return failureCount < 6;
          }
        }
        return failureCount < 1;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('No se encontró #root');
}

createRoot(rootEl).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <PwaReloadButton />
        <AuthSessionGate>
          <ApiConnectionBanner />
          <AppRoutes />
          <AppRecoveryBanner />
        </AuthSessionGate>
      </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>
);
