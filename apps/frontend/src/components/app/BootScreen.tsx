import { RefreshCw } from 'lucide-react';

interface BootScreenProps {
  title?: string;
  message: string;
  hint?: string;
  onRetry?: () => void;
  onReload?: () => void;
  retryLabel?: string;
  busy?: boolean;
}

/**
 * Pantalla de arranque / espera de sesión o servidor.
 * Reemplaza pantallas blancas con feedback claro.
 */
export function BootScreen({
  title = 'Contaduría Municipal',
  message,
  hint,
  onRetry,
  onReload,
  retryLabel = 'Reintentar',
  busy = true,
}: BootScreenProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary-950 px-4 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-600 text-lg font-bold tracking-tight text-white">
        CM
      </div>
      <h1 className="text-lg font-semibold text-white">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-primary-200">{message}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-primary-300/80">{hint}</p>}

      {busy && (
        <div
          className="mt-6 h-8 w-8 animate-spin rounded-full border-2 border-primary-300 border-t-transparent"
          aria-hidden
        />
      )}

      {(onRetry || onReload) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-500"
            >
              <RefreshCw size={14} />
              {retryLabel}
            </button>
          )}
          {onReload && (
            <button
              type="button"
              onClick={onReload}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary-700 bg-primary-900/60 px-3.5 py-2 text-sm font-medium text-primary-100 hover:bg-primary-900"
            >
              <RefreshCw size={14} />
              Recargar aplicación
            </button>
          )}
        </div>
      )}
    </div>
  );
}
