import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, Calendar, FolderOpen, User, Wallet } from 'lucide-react';
import { getLibramientoAnticipo, anularLibramientoAnticipo } from '@/services/libramientosAnticipo.service';
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

export function LibramientoAnticipoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission('libramientos:write'));
  const libId = Number(id);
  const [anularModal, setAnularModal] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [formError, setFormError] = useState('');

  const { data: lib, isLoading, error } = useQuery({
    queryKey: ['libramiento-anticipo', libId],
    queryFn: () => getLibramientoAnticipo(libId),
    enabled: !isNaN(libId),
  });

  const anularMutation = useMutation({
    mutationFn: () => anularLibramientoAnticipo(libId, motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['libramiento-anticipo', libId] });
      queryClient.invalidateQueries({ queryKey: ['libramientos'] });
      queryClient.invalidateQueries({ queryKey: ['libramientos-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['libramientos-anticipo'] });
      queryClient.invalidateQueries({ queryKey: ['expedientes'] });
      queryClient.invalidateQueries({ queryKey: ['expediente'] });
      setAnularModal(false);
      setMotivo('');
    },
    onError: (err) =>
      setFormError(err instanceof ApiClientError ? err.message : 'Error al anular'),
  });

  if (isLoading) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">Cargando libramiento...</div>
    );
  }

  if (error || !lib) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-sm text-slate-500">Libramiento de anticipo no encontrado</p>
        <Link to="/libramientos" className="text-sm text-primary-600 hover:underline">
          Volver al listado
        </Link>
      </div>
    );
  }

  const puedeAnular =
    canWrite && !lib.anulado && !lib.pagado && Number(lib.monto_pagado ?? 0) <= 0.01;

  return (
    <div className="space-y-4">
      <DetailBackNav listTo="/libramientos" listLabel="Volver a libramientos" />

      {formError && <Alert type="error">{formError}</Alert>}

      <SpreadsheetShell
        title={lib.numero_completo}
        subtitle={lib.beneficiario}
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
            {lib.anulado ? (
              <StatusBadge label="Anulado" variant="danger" />
            ) : lib.pagado ? (
              <StatusBadge label="Pagado" variant="info" />
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
                  {formatDate(lib.fecha)}
                </span>
              ),
            },
            {
              label: 'Expediente',
              value: (
                <Link
                  to={`/expedientes/${lib.expediente_id}`}
                  state={buildReturnState(`/libramientos-anticipo/${lib.id}`)}
                  className="inline-flex items-center gap-1.5 font-mono text-primary-700 hover:underline"
                >
                  <FolderOpen size={14} />
                  {lib.expediente_numero}
                </Link>
              ),
            },
            {
              label: 'Anticipo',
              value: (
                <Link
                  to={`/anticipos/${lib.anticipo_id}`}
                  state={buildReturnState(`/libramientos-anticipo/${lib.id}`)}
                  className="inline-flex items-center gap-1.5 font-mono text-primary-700 hover:underline"
                >
                  <Wallet size={14} />
                  {lib.anticipo_numero}
                </Link>
              ),
            },
            {
              label: 'Beneficiario',
              value: (
                <span className="inline-flex items-center gap-1.5">
                  <User size={14} className="text-slate-400" />
                  {lib.beneficiario}
                </span>
              ),
            },
            {
              label: 'Importe',
              value: <span className="tabular-nums">{formatCurrency(lib.importe)}</span>,
            },
            {
              label: 'Retenciones',
              value: <span className="tabular-nums">{formatCurrency(lib.retenciones)}</span>,
            },
            {
              label: 'Neto',
              value: (
                <span className="font-semibold tabular-nums text-emerald-700">
                  {formatCurrency(lib.neto)}
                </span>
              ),
            },
            {
              label: 'N° decreto',
              value: lib.numero_decreto || '—',
            },
            {
              label: 'Observaciones',
              value: lib.observaciones || '—',
            },
            ...(lib.anulado
              ? [{ label: 'Motivo anulación', value: lib.motivo_anulacion || '—' }]
              : []),
          ]}
        />
      </SpreadsheetShell>

      <Modal
        open={anularModal}
        onClose={() => setAnularModal(false)}
        title="Anular libramiento de anticipo"
        size="sm"
      >
        <p className="mb-3 text-sm text-slate-600">
          El expediente volverá a estado Anticipado si no quedan otros libramientos de anticipo
          vigentes.
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
