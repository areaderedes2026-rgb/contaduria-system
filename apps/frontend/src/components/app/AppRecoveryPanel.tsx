import { RefreshCw, Download, AlertTriangle, WifiOff } from 'lucide-react';
import type { RecoveryReason } from '@/utils/chunkError';
import { Button } from '@/components/ui/Button';

const COPY: Record<
  RecoveryReason,
  { title: string; message: string; icon: typeof RefreshCw; clearCaches?: boolean }
> = {
  update: {
    title: 'Nueva versión disponible',
    message:
      'Se actualizó la aplicación. Recargá para usar la última versión y evitar pantallas en blanco.',
    icon: Download,
  },
  chunk: {
    title: 'La aplicación necesita recargarse',
    message:
      'Hay archivos desactualizados en caché (común después de una actualización o al abrir la PWA). Recargá para continuar.',
    icon: RefreshCw,
    clearCaches: true,
  },
  crash: {
    title: 'Ocurrió un error inesperado',
    message:
      'La pantalla dejó de responder. Recargá la aplicación para volver a un estado estable. Esto no es un problema de sesión.',
    icon: AlertTriangle,
  },
  offline: {
    title: 'Sin conexión',
    message:
      'No hay acceso a internet. Cuando vuelva la conexión, recargá si la pantalla queda en blanco.',
    icon: WifiOff,
  },
};

interface AppRecoveryPanelProps {
  reason: RecoveryReason;
  onReload: (opts?: { clearCaches?: boolean }) => void;
  variant?: 'banner' | 'fullscreen';
  onDismiss?: () => void;
  reloading?: boolean;
}

export function AppRecoveryPanel({
  reason,
  onReload,
  variant = 'fullscreen',
  onDismiss,
  reloading = false,
}: AppRecoveryPanelProps) {
  const { title, message, icon: Icon, clearCaches } = COPY[reason];
  const isBanner = variant === 'banner';

  const handleReload = () => onReload(clearCaches ? { clearCaches: true } : undefined);

  if (isBanner) {
    return (
      <div
        className="fixed inset-x-0 bottom-0 z-[100] border-t border-amber-300 bg-amber-50 px-4 py-3 shadow-lg sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md sm:rounded-lg sm:border"
        role="alertdialog"
        aria-live="assertive"
        aria-label={title}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
            <Icon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-950">{title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-amber-900/90">{message}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={handleReload} loading={reloading}>
                <RefreshCw size={14} />
                Recargar ahora
              </Button>
              {onDismiss && reason === 'update' && (
                <Button size="sm" variant="secondary" onClick={onDismiss}>
                  Después
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-300 bg-white p-6 shadow-lg">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-800">
          <Icon size={24} />
        </div>
        <h1 className="text-center text-lg font-semibold text-slate-800">{title}</h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">{message}</p>
        <div className="mt-6 flex flex-col items-center gap-2">
          <Button onClick={handleReload} loading={reloading} size="lg">
            <RefreshCw size={16} />
            Recargar aplicación
          </Button>
          {clearCaches && (
            <button
              type="button"
              onClick={() => onReload({ clearCaches: true })}
              className="text-xs text-slate-500 underline-offset-2 hover:underline"
            >
              Limpiar caché y recargar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
