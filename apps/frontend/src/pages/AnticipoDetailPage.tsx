import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, Calendar, FolderOpen, User } from 'lucide-react';
import { getAnticipo, anularAnticipo } from '@/services/anticipos.service';
import {
  SpreadsheetShell,
  SpreadsheetPropertyGrid,
  StatusBadge,
} from '@/components/spreadsheet';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { DetailBackNav } from '@/components/layout/DetailBackNav';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatDate } from '@/utils/format';
import { buildReturnState } from '@/utils/navigationReturn';
import { ApiClientError } from '@/services/api';

export function AnticipoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission('afectaciones:write'));
  const anticipoId = Number(id);
  const [anularModal, setAnularModal] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [formError, setFormError] = useState('');

  const { data: anticipo, isLoading, error } = useQuery({
    queryKey: ['anticipo', anticipoId],
    queryFn: () => getAnticipo(anticipoId),
    enabled: !isNaN(anticipoId),
  });

  const anularMutation = useMutation({
    mutationFn: () => anularAnticipo(anticipoId, motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anticipo', anticipoId] });
      queryClient.invalidateQueries({ queryKey: ['anticipos'] });
      queryClient.invalidateQueries({ queryKey: ['anticipos-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['expedientes'] });
      queryClient.invalidateQueries({ queryKey: ['expediente'] });
      setAnularModal(false);
      setMotivo('');
    },
    onError: (err) =>
      setFormError(err instanceof ApiClientError ? err.message : 'Error al anular'),
  });

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-slate-500">Cargando anticipo...</div>;
  }

  if (error || !anticipo) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-sm text-slate-500">Anticipo no encontrado</p>
        <Link to="/anticipos" className="text-sm text-primary-600 hover:underline">
          Volver al listado
        </Link>
      </div>
    );
  }

  const puedeAnular = canWrite && !anticipo.anulada;

  return (
    <div className="space-y-4">
      <DetailBackNav listTo="/anticipos" listLabel="Volver a anticipos" />

      {formError && <Alert type="error">{formError}</Alert>}

      <SpreadsheetShell
        title={anticipo.numero_completo}
        subtitle={anticipo.destinatario}
        actions={
          puedeAnular ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setFormError('');
                setAnularModal(true);
              }}
            >
              <Ban size={14} /> Anular
            </Button>
          ) : undefined
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            {anticipo.anulada ? (
              <StatusBadge label="Anulado" variant="danger" />
            ) : (
              <StatusBadge label="Activo" variant="success" />
            )}
          </div>
        }
      >
        <SpreadsheetPropertyGrid
          rows={[
            {
              label: 'Fecha',
              value: (
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Calendar size={14} className="text-slate-400" />
                  {formatDate(anticipo.fecha)}
                </span>
              ),
            },
            {
              label: 'Expediente',
              value: (
                <Link
                  to={`/expedientes/${anticipo.expediente_id}`}
                  state={buildReturnState(`/anticipos/${anticipo.id}`)}
                  className="inline-flex items-center gap-1.5 font-mono text-primary-700 hover:underline"
                >
                  <FolderOpen size={14} />
                  {anticipo.expediente_numero}
                </Link>
              ),
            },
            {
              label: 'Destinatario',
              value: (
                <span className="inline-flex items-center gap-1.5">
                  <User size={14} className="text-slate-400" />
                  {anticipo.destinatario}
                </span>
              ),
            },
            {
              label: 'Cuenta',
              value: (
                <span>
                  <span className="font-mono font-semibold">{anticipo.cuenta_codigo}</span>
                  {anticipo.cuenta_descripcion ? (
                    <span className="ml-2 text-slate-600">{anticipo.cuenta_descripcion}</span>
                  ) : null}
                </span>
              ),
            },
            {
              label: 'Importe',
              value: (
                <span className="font-semibold tabular-nums text-emerald-700">
                  {formatCurrency(anticipo.importe)}
                </span>
              ),
            },
            {
              label: 'Comprobante',
              value: anticipo.numero_comprobante || '—',
            },
            {
              label: 'Observaciones',
              value: anticipo.observaciones || '—',
            },
            ...(anticipo.anulada
              ? [
                  {
                    label: 'Motivo anulación',
                    value: anticipo.motivo_anulacion || '—',
                  },
                ]
              : []),
          ]}
        />
      </SpreadsheetShell>

      <Modal open={anularModal} onClose={() => setAnularModal(false)} title="Anular anticipo" size="sm">
        <p className="mb-3 text-sm text-slate-600">
          Se revertirá el saldo de la cuenta Fondo a rendir. Si hay un libramiento vigente, anúlelo
          primero.
        </p>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={4}
          placeholder="Motivo (mínimo 5 caracteres)"
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setAnularModal(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={anularMutation.isPending}
            disabled={motivo.trim().length < 5}
            onClick={() => anularMutation.mutate()}
          >
            Anular
          </Button>
        </div>
      </Modal>
    </div>
  );
}
