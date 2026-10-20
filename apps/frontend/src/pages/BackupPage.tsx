import { useState } from 'react';
import { Database, Download, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { descargarRespaldo } from '@/services/backup.service';
import { useAuthStore } from '@/stores/authStore';

export function BackupPage() {
  const canWrite = useAuthStore((s) => s.hasPermission('configuracion:write'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const handleBackup = async () => {
    setError('');
    setOk('');
    setBusy(true);
    try {
      const name = await descargarRespaldo();
      setOk(
        `Respaldo guardado: ${name}. Guárdelo en un pendrive o súbalo a la nube. Con ese archivo se puede restaurar toda la información.`
      );
    } catch (err) {
      if (err instanceof Error && err.message === 'CANCELLED') {
        setError('');
        return;
      }
      setError(err instanceof Error ? err.message : 'No se pudo generar el respaldo');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Respaldo</h1>
        <p className="mt-1 text-sm text-slate-600">
          Copia completa de la base de datos (expedientes, cuentas, proveedores, documentos,
          usuarios y auditoría). El programa en sí se reinstala desde Git; este archivo es lo que
          no se puede perder.
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {ok && <Alert type="success">{ok}</Alert>}

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-800">
            <Database size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Generar respaldo ahora</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Se abre una ventana para elegir la carpeta (por ejemplo Descargas). El archivo es{' '}
              <span className="font-mono text-xs">.sql.gz</span>: comprimido, no requiere WinRAR y
              contiene toda la base.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <Button onClick={handleBackup} loading={busy} disabled={!canWrite || busy} size="lg">
            <Download size={18} />
            Descargar respaldo
          </Button>
        </div>

        {!canWrite && (
          <p className="mt-3 text-xs text-slate-500">Solo el administrador puede generar respaldos.</p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        <p className="flex items-center gap-2 font-semibold text-slate-900">
          <Cloud size={16} />
          Después de descargar
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 leading-relaxed">
          <li>Guarde una copia en USB y otra en la nube (Drive, OneDrive, etc.).</li>
          <li>Haga un respaldo al cierre de cada jornada o al menos una vez por semana.</li>
          <li>
            Para recuperar en una PC nueva: instale el sistema (guía de despliegue), copie el
            archivo y en el servidor ejecute{' '}
            <span className="font-mono text-xs">npm run db:restore -- ruta\al\archivo.sql.gz</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
