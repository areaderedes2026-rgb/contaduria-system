import { useState, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  Calendar,
  ExternalLink,
  FileText,
  FolderOpen,
  Receipt,
  User,
} from 'lucide-react';
import { getPago, anularPago, MEDIO_PAGO_LABELS } from '@/services/pagos.service';
import {
  SpreadsheetShell,
  SpreadsheetPropertyGrid,
  StatusBadge,
  spreadsheet,
} from '@/components/spreadsheet';
import { DetailBackNav } from '@/components/layout/DetailBackNav';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatDate } from '@/utils/format';
import { importeEnLetras } from '@/utils/importeEnLetras';
import { buildReturnState } from '@/utils/navigationReturn';
import { ApiClientError } from '@/services/api';

function SidePanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`${spreadsheet.shell} overflow-hidden`}>
      <div className="flex items-center gap-2 border-b border-slate-300 bg-[#e2e8f0] px-4 py-2.5">
        {icon}
        <span className="text-sm font-semibold text-slate-700">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function PagoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission('pagos:write'));
  const pagoId = Number(id);

  const [anularModal, setAnularModal] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [formError, setFormError] = useState('');

  const { data: pago, isLoading, error } = useQuery({
    queryKey: ['pago', pagoId],
    queryFn: () => getPago(pagoId),
    enabled: !isNaN(pagoId),
  });

  const anularMutation = useMutation({
    mutationFn: () => anularPago(pagoId, motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pago', pagoId] });
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
      queryClient.invalidateQueries({ queryKey: ['pagos-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['libramientos'] });
      queryClient.invalidateQueries({ queryKey: ['libramientos-pendientes-pago'] });
      queryClient.invalidateQueries({ queryKey: ['expedientes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setAnularModal(false);
      setMotivo('');
    },
    onError: (err) =>
      setFormError(err instanceof ApiClientError ? err.message : 'Error al anular'),
  });

  const returnState = buildReturnState(`/pagos/${pagoId}`, 'Volver al detalle del pago');

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-slate-500">Cargando pago...</div>;
  }

  if (error || !pago) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-sm text-slate-500">Pago no encontrado</p>
        <DetailBackNav listTo="/pagos" listLabel="Volver a pagos" />
      </div>
    );
  }

  const monto = Number(pago.monto) || 0;
  const letras = importeEnLetras(monto);

  return (
    <div className="space-y-4 pb-8">
      <DetailBackNav listTo="/pagos" listLabel="Volver a pagos" />

      {pago.anulado && (
        <Alert type="error">
          Pago anulado
          {pago.fecha_anulacion ? ` el ${formatDate(String(pago.fecha_anulacion).slice(0, 10))}` : ''}
          {pago.motivo_anulacion ? `: ${pago.motivo_anulacion}` : '.'}
        </Alert>
      )}

      <SpreadsheetShell
        title={`Pago ${pago.numero_completo}`}
        subtitle={pago.beneficiario}
        actions={
          canWrite && !pago.anulado ? (
            <button
              type="button"
              onClick={() => {
                setFormError('');
                setAnularModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
            >
              <Ban size={14} />
              Anular pago
            </button>
          ) : undefined
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={pago.anulado ? 'Anulado' : 'Vigente'}
              variant={pago.anulado ? 'danger' : 'success'}
            />
            <span className="text-slate-400">|</span>
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
              <Calendar size={14} className="text-slate-400" />
              <span className="tabular-nums">{formatDate(pago.fecha_pago)}</span>
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-sm text-slate-600">
              Medio: <strong>{MEDIO_PAGO_LABELS[pago.medio_pago]}</strong>
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-sm font-medium tabular-nums text-emerald-700">
              {formatCurrency(monto)}
            </span>
          </div>
        }
      >
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)]">
          <div className="min-w-0 border-b border-slate-200 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-200 bg-[#f8fafc] px-4 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Datos del pago
              </h2>
            </div>
            <SpreadsheetPropertyGrid
              rows={[
                {
                  label: 'Número',
                  value: (
                    <span className="font-mono text-base font-semibold text-slate-900">
                      {pago.numero_completo}
                    </span>
                  ),
                },
                {
                  label: 'Fecha de pago',
                  value: <span className="tabular-nums">{formatDate(pago.fecha_pago)}</span>,
                },
                {
                  label: 'Beneficiario',
                  value: <span className="font-medium text-slate-900">{pago.beneficiario}</span>,
                },
                {
                  label: 'Medio de pago',
                  value: <span className="font-medium">{MEDIO_PAGO_LABELS[pago.medio_pago]}</span>,
                },
                {
                  label: 'Nº comprobante',
                  value: pago.numero_comprobante ? (
                    <span className="font-mono">{pago.numero_comprobante}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  ),
                },
                {
                  label: 'Banco',
                  value: pago.banco || <span className="text-slate-400">—</span>,
                },
                {
                  label: 'Expediente',
                  value: (
                    <Link
                      to={`/expedientes/${pago.expediente_id}`}
                      state={returnState}
                      className="inline-flex items-center gap-1.5 font-mono text-primary-700 hover:underline"
                    >
                      <FolderOpen size={14} />
                      {pago.expediente_numero || `#${pago.expediente_id}`}
                      <ExternalLink size={12} className="opacity-60" />
                    </Link>
                  ),
                },
                {
                  label: 'Libramiento',
                  value: (
                    <Link
                      to={`/libramientos/${pago.libramiento_id}`}
                      state={returnState}
                      className="inline-flex items-center gap-1.5 font-mono text-primary-700 hover:underline"
                    >
                      <FileText size={14} />
                      {pago.libramiento_numero || `#${pago.libramiento_id}`}
                      <ExternalLink size={12} className="opacity-60" />
                    </Link>
                  ),
                },
                {
                  label: 'Estado',
                  value: (
                    <StatusBadge
                      label={pago.anulado ? 'Anulado' : 'Vigente'}
                      variant={pago.anulado ? 'danger' : 'success'}
                    />
                  ),
                },
                ...(pago.observaciones?.trim()
                  ? [
                      {
                        label: 'Observaciones',
                        value: (
                          <span className="whitespace-pre-wrap text-slate-600">
                            {pago.observaciones}
                          </span>
                        ),
                      },
                    ]
                  : []),
                ...(pago.anulado && pago.motivo_anulacion
                  ? [
                      {
                        label: 'Motivo anulación',
                        value: (
                          <span className="whitespace-pre-wrap text-red-700">
                            {pago.motivo_anulacion}
                          </span>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </div>

          <div className="flex min-w-0 flex-col bg-[#f8fafc]">
            <div className="border-b border-slate-200 px-4 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Resumen financiero
              </h2>
            </div>
            <div className="space-y-3 p-4">
              <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3.5 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-emerald-800/80">
                  Monto pagado
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">
                  {formatCurrency(monto)}
                </div>
                <p className="mt-2 text-[11px] leading-snug text-emerald-900/70">{letras}</p>
              </div>

              <div className="rounded-md border border-slate-200 bg-white px-3.5 py-3 text-sm">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Receipt size={13} />
                  Medio
                </div>
                <dl className="space-y-1.5">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Tipo</dt>
                    <dd className="font-medium text-slate-800">
                      {MEDIO_PAGO_LABELS[pago.medio_pago]}
                    </dd>
                  </div>
                  {pago.numero_comprobante && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Comprobante</dt>
                      <dd className="font-mono text-slate-800">{pago.numero_comprobante}</dd>
                    </div>
                  )}
                  {pago.banco && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Banco</dt>
                      <dd className="text-slate-800">{pago.banco}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="rounded-md border border-slate-200 bg-white px-3.5 py-3 text-sm">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <User size={13} />
                  Registro
                </div>
                <dl className="space-y-1.5 text-slate-600">
                  {pago.usuario_registro_nombre && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Registrado por</dt>
                      <dd className="text-right font-medium text-slate-800">
                        {pago.usuario_registro_nombre}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Registrado</dt>
                    <dd className="text-right tabular-nums">
                      {new Date(pago.created_at).toLocaleString('es-AR')}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Actualizado</dt>
                    <dd className="text-right tabular-nums">
                      {new Date(pago.updated_at).toLocaleString('es-AR')}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </SpreadsheetShell>

      <div className="grid gap-4 lg:grid-cols-2">
        <SidePanel
          title="Documentos vinculados"
          icon={<FolderOpen size={15} className="text-slate-500" />}
        >
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link
                to={`/expedientes/${pago.expediente_id}`}
                state={returnState}
                className="group flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 transition hover:border-primary-300 hover:bg-primary-50/40"
              >
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Expediente
                  </div>
                  <div className="font-mono font-semibold text-primary-800 group-hover:underline">
                    {pago.expediente_numero || `#${pago.expediente_id}`}
                  </div>
                </div>
                <ExternalLink size={14} className="text-slate-400" />
              </Link>
            </li>
            <li>
              <Link
                to={`/libramientos/${pago.libramiento_id}`}
                state={returnState}
                className="group flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 transition hover:border-primary-300 hover:bg-primary-50/40"
              >
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Libramiento de pago
                  </div>
                  <div className="font-mono font-semibold text-primary-800 group-hover:underline">
                    {pago.libramiento_numero || `#${pago.libramiento_id}`}
                  </div>
                </div>
                <span className="tabular-nums text-sm font-medium text-emerald-700">
                  {formatCurrency(monto)}
                </span>
              </Link>
            </li>
          </ul>
        </SidePanel>

        <SidePanel title="Estado del pago" icon={<Receipt size={15} className="text-slate-500" />}>
          <p className="mb-3 text-sm text-slate-600">
            {pago.anulado
              ? 'Este pago está anulado. El saldo del libramiento se recalculó; si el expediente estaba Pagado y quedó saldo, volvió a Librado.'
              : 'Pago vigente. El monto queda acumulado en el libramiento; si completa el neto, el libramiento figura como pagado y el expediente en estado Pagado.'}
          </p>
          <StatusBadge
            label={pago.anulado ? 'Anulado' : 'Vigente'}
            variant={pago.anulado ? 'danger' : 'success'}
          />
        </SidePanel>
      </div>

      <Modal open={anularModal} onClose={() => setAnularModal(false)} title="Anular pago" size="sm">
        {formError && (
          <div className="mb-4">
            <Alert type="error">{formError}</Alert>
          </div>
        )}
        <p className="mb-4 text-sm text-slate-600">
          Se revertirá el estado del libramiento y, si corresponde, el expediente volverá a estado
          Librado.
        </p>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          className="mb-4 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          placeholder="Motivo de anulación (mínimo 5 caracteres)"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setAnularModal(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={anularMutation.isPending}
            disabled={motivo.length < 5}
            onClick={() => anularMutation.mutate()}
          >
            Confirmar anulación
          </Button>
        </div>
      </Modal>
    </div>
  );
}
