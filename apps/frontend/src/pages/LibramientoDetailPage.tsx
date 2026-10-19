import { useMemo, useState, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  Banknote,
  Calendar,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Printer,
  Receipt,
  User,
} from 'lucide-react';
import { getLibramiento, anularLibramiento } from '@/services/libramientos.service';
import { getPagos, MEDIO_PAGO_LABELS } from '@/services/pagos.service';
import {
  SpreadsheetShell,
  SpreadsheetPropertyGrid,
  SpreadsheetSection,
  SpreadsheetGrid,
  StatusBadge,
  spreadsheet,
  type SpreadsheetColumn,
} from '@/components/spreadsheet';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { DetailBackNav } from '@/components/layout/DetailBackNav';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatDate } from '@/utils/format';
import { importeEnLetras } from '@/utils/importeEnLetras';
import { buildReturnState } from '@/utils/navigationReturn';
import { ApiClientError } from '@/services/api';
import { usePrintLibramiento } from '@/hooks/usePrintLibramiento';
import type { LibramientoDetalle, Pago } from '@/types';

function libramientoEstadoBadge(libramiento: {
  anulado: boolean;
  pagado: boolean;
  monto_pagado?: number;
}) {
  if (libramiento.anulado) return <StatusBadge label="Anulado" variant="danger" />;
  if (libramiento.pagado) return <StatusBadge label="Pagado" variant="info" />;
  if (Number(libramiento.monto_pagado ?? 0) > 0.01) {
    return <StatusBadge label="Pago parcial" variant="warning" />;
  }
  return <StatusBadge label="Activo" variant="success" />;
}

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

export function LibramientoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission('libramientos:write'));
  const canPay = useAuthStore((s) => s.hasPermission('pagos:write'));
  const canReadPagos = useAuthStore((s) => s.hasPermission('pagos:read'));
  const libramientoId = Number(id);
  const { print, printing, downloadPdf, downloadingPdf } = usePrintLibramiento();

  const [anularModal, setAnularModal] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [formError, setFormError] = useState('');

  const { data: libramiento, isLoading, error } = useQuery({
    queryKey: ['libramiento', libramientoId],
    queryFn: () => getLibramiento(libramientoId),
    enabled: !isNaN(libramientoId),
  });

  const { data: pagosLib } = useQuery({
    queryKey: ['pagos', { libramientoId, anulado: false }],
    queryFn: () =>
      getPagos({
        libramientoId,
        anulado: false,
        limit: 50,
        sortBy: 'fecha_pago',
        sortOrder: 'asc',
      }),
    enabled: !isNaN(libramientoId) && canReadPagos,
  });

  const anularMutation = useMutation({
    mutationFn: () => anularLibramiento(libramientoId, motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['libramiento', libramientoId] });
      queryClient.invalidateQueries({ queryKey: ['libramientos'] });
      queryClient.invalidateQueries({ queryKey: ['libramientos-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['expedientes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setAnularModal(false);
      setMotivo('');
    },
    onError: (err) =>
      setFormError(err instanceof ApiClientError ? err.message : 'Error al anular'),
  });

  const returnState = useMemo(
    () =>
      buildReturnState(
        `/libramientos/${libramientoId}`,
        'Volver al detalle del libramiento'
      ),
    [libramientoId]
  );

  const detalleColumns: SpreadsheetColumn<LibramientoDetalle>[] = useMemo(
    () => [
      {
        key: 'codigo',
        header: 'Código',
        width: 'w-28',
        render: (line) => {
          const codigo = line.cuenta_codigo?.trim();
          if (!codigo) return <span className="text-slate-400">—</span>;
          return (
            <Link
              to={`/plan-cuentas?q=${encodeURIComponent(codigo)}&exact=1`}
              state={returnState}
              className="font-mono font-medium text-primary-700 hover:underline"
              title="Ver en plan de cuentas"
            >
              {codigo}
            </Link>
          );
        },
      },
      {
        key: 'cuenta',
        header: 'Cuenta',
        render: (line) => (
          <span className="text-slate-600">{line.cuenta_descripcion || '—'}</span>
        ),
      },
      {
        key: 'descripcion',
        header: 'Descripción',
        render: (line) => {
          const text = (line.descripcion || '').trim() || (line.cuenta_descripcion || '').trim();
          return <span className="text-slate-700">{text || '—'}</span>;
        },
      },
      {
        key: 'importe',
        header: 'Importe',
        width: 'w-32',
        align: 'right',
        render: (line) => (
          <span className="font-medium tabular-nums">{formatCurrency(line.importe)}</span>
        ),
      },
    ],
    [returnState]
  );

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-slate-500">Cargando...</div>;
  }

  if (error || !libramiento) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-sm text-slate-500">Libramiento no encontrado</p>
        <DetailBackNav listTo="/libramientos" listLabel="Volver a libramientos" />
      </div>
    );
  }

  const importe = Number(libramiento.importe) || 0;
  const retenciones = Number(libramiento.retenciones) || 0;
  const neto = Number(libramiento.neto) || 0;
  const montoPagado = Number(libramiento.monto_pagado ?? 0) || 0;
  const saldoPendiente = Math.round((neto - montoPagado) * 100) / 100;
  const pctRetencion = importe > 0 ? (retenciones / importe) * 100 : 0;
  const cuentasCount = libramiento.detalle?.length ?? 0;
  const letrasNeto = importeEnLetras(neto);
  const puedePagar = canPay && !libramiento.anulado && !libramiento.pagado;
  const puedeAnular =
    canWrite && !libramiento.anulado && !libramiento.pagado && montoPagado <= 0.01;
  const pagosActivos: Pago[] = pagosLib?.data ?? [];

  return (
    <div className="space-y-4 pb-8">
      <DetailBackNav listTo="/libramientos" listLabel="Volver a libramientos" />

      {libramiento.anulado && (
        <Alert type="error">
          Libramiento anulado
          {libramiento.fecha_anulacion
            ? ` el ${formatDate(libramiento.fecha_anulacion)}`
            : ''}
          {libramiento.motivo_anulacion
            ? `: ${libramiento.motivo_anulacion}`
            : '.'}
        </Alert>
      )}

      <SpreadsheetShell
        title={`Libramiento ${libramiento.numero_completo}`}
        subtitle={libramiento.beneficiario}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void print(libramientoId)}
              disabled={printing || downloadingPdf || libramiento.anulado}
              title={
                libramiento.anulado
                  ? 'No se puede imprimir un libramiento anulado'
                  : 'Imprimir sobre formulario preimpreso'
              }
              className="inline-flex items-center gap-1.5 rounded bg-white/15 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Printer size={14} />
              {printing ? 'Preparando...' : 'Imprimir'}
            </button>
            <button
              type="button"
              onClick={() => void downloadPdf(libramientoId)}
              disabled={printing || downloadingPdf || libramiento.anulado}
              title={
                libramiento.anulado
                  ? 'No se puede descargar el PDF de un libramiento anulado'
                  : 'Descargar overlay en PDF'
              }
              className="inline-flex items-center gap-1.5 rounded bg-white/15 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download size={14} />
              {downloadingPdf ? 'Generando PDF...' : 'Descargar PDF'}
            </button>
            {puedePagar && (
              <Link
                to={`/pagos?libramiento=${libramientoId}`}
                className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-emerald-700"
              >
                <Banknote size={14} />
                Registrar pago
              </Link>
            )}
            {puedeAnular && (
              <button
                type="button"
                onClick={() => {
                  setFormError('');
                  setAnularModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
              >
                <Ban size={14} /> Anular
              </button>
            )}
          </div>
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            {libramientoEstadoBadge(libramiento)}
            <span className="text-slate-400">|</span>
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
              <Calendar size={14} className="text-slate-400" />
              <span className="tabular-nums">{formatDate(libramiento.fecha)}</span>
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-sm text-slate-600">
              Neto{' '}
              <strong className="tabular-nums text-emerald-700">{formatCurrency(neto)}</strong>
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-sm text-slate-600">
              <span className="tabular-nums font-medium">{cuentasCount}</span>{' '}
              {cuentasCount === 1 ? 'cuenta' : 'cuentas'}
            </span>
          </div>
        }
      >
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)]">
          {/* Columna izquierda — datos del documento */}
          <div className="min-w-0 border-b border-slate-200 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-200 bg-[#f8fafc] px-4 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Datos del documento
              </h2>
            </div>
            <SpreadsheetPropertyGrid
              rows={[
                {
                  label: 'Número',
                  value: (
                    <span className="font-mono text-base font-semibold text-slate-900">
                      {libramiento.numero_completo}
                    </span>
                  ),
                },
                {
                  label: 'Fecha de emisión',
                  value: (
                    <span className="tabular-nums">{formatDate(libramiento.fecha)}</span>
                  ),
                },
                {
                  label: 'Beneficiario',
                  value: (
                    <span className="font-medium text-slate-900">{libramiento.beneficiario}</span>
                  ),
                },
                {
                  label: 'Nº decreto / resol.',
                  value: libramiento.numero_decreto?.trim() ? (
                    <span className="font-mono">{libramiento.numero_decreto}</span>
                  ) : (
                    <span className="text-amber-700">Sin cargar</span>
                  ),
                },
                {
                  label: 'Expediente',
                  value: (
                    <Link
                      to={`/expedientes/${libramiento.expediente_id}`}
                      state={returnState}
                      className="inline-flex items-center gap-1.5 font-mono text-primary-700 hover:underline"
                    >
                      <FolderOpen size={14} />
                      {libramiento.expediente_numero || `#${libramiento.expediente_id}`}
                      <ExternalLink size={12} className="opacity-60" />
                    </Link>
                  ),
                },
                {
                  label: 'Afectación',
                  value: (
                    <Link
                      to={`/afectaciones/${libramiento.afectacion_id}`}
                      state={returnState}
                      className="inline-flex items-center gap-1.5 font-mono text-primary-700 hover:underline"
                    >
                      <FileText size={14} />
                      {libramiento.afectacion_numero || `#${libramiento.afectacion_id}`}
                      <ExternalLink size={12} className="opacity-60" />
                    </Link>
                  ),
                },
                {
                  label: 'Estado',
                  value: libramientoEstadoBadge(libramiento),
                },
                {
                  label: 'Estado de pago',
                  value: libramiento.pagado ? (
                    <span className="font-medium text-sky-800">
                      Pagado
                      {libramiento.fecha_pago
                        ? ` · ${formatDate(libramiento.fecha_pago)}`
                        : ''}
                    </span>
                  ) : libramiento.anulado ? (
                    <span className="text-slate-500">No aplica</span>
                  ) : montoPagado > 0.01 ? (
                    <span className="font-medium text-amber-800">
                      Pago parcial · pagado {formatCurrency(montoPagado)} · saldo{' '}
                      {formatCurrency(saldoPendiente)}
                    </span>
                  ) : (
                    <span className="font-medium text-amber-700">Pendiente de pago</span>
                  ),
                },
                ...(libramiento.observaciones?.trim()
                  ? [
                      {
                        label: 'Observaciones',
                        value: (
                          <span className="whitespace-pre-wrap text-slate-600">
                            {libramiento.observaciones}
                          </span>
                        ),
                      },
                    ]
                  : []),
                ...(libramiento.anulado && libramiento.motivo_anulacion
                  ? [
                      {
                        label: 'Motivo anulación',
                        value: (
                          <span className="whitespace-pre-wrap text-red-700">
                            {libramiento.motivo_anulacion}
                          </span>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </div>

          {/* Columna derecha — resumen + auditoría */}
          <div className="flex min-w-0 flex-col bg-[#f8fafc]">
            <div className="border-b border-slate-200 px-4 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Resumen financiero
              </h2>
            </div>
            <div className="space-y-3 p-4">
              <div className="rounded-md border border-slate-200 bg-white px-3.5 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Importe bruto
                </div>
                <div className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                  {formatCurrency(importe)}
                </div>
              </div>

              <div className="rounded-md border border-amber-200 bg-amber-50/80 px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-amber-800/80">
                    Retenciones
                  </div>
                  {pctRetencion > 0 && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-900">
                      {pctRetencion.toFixed(2)}%
                    </span>
                  )}
                </div>
                <div className="mt-1 text-lg font-bold tabular-nums text-amber-900">
                  {formatCurrency(retenciones)}
                </div>
              </div>

              <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3.5 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-emerald-800/80">
                  Líquido a pagar
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">
                  {formatCurrency(neto)}
                </div>
                <p className="mt-2 text-[11px] leading-snug text-emerald-900/70">
                  {letrasNeto}
                </p>
              </div>

              {(montoPagado > 0.01 || libramiento.pagado) && (
                <div className="rounded-md border border-sky-200 bg-sky-50/80 px-3.5 py-3 text-sm">
                  <div className="space-y-1.5 tabular-nums">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Pagado acumulado</span>
                      <span className="font-semibold text-sky-800">
                        {formatCurrency(montoPagado)}
                      </span>
                    </div>
                    {!libramiento.pagado && (
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">Saldo pendiente</span>
                        <span className="font-bold text-amber-800">
                          {formatCurrency(saldoPendiente)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-md border border-slate-200 bg-white px-3.5 py-3 text-sm">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Receipt size={13} />
                  Desglose
                </div>
                <div className="space-y-1.5 tabular-nums">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Bruto</span>
                    <span className="font-medium text-slate-800">{formatCurrency(importe)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">− Retenciones</span>
                    <span className="font-medium text-amber-800">
                      {formatCurrency(retenciones)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-100 pt-1.5">
                    <span className="font-semibold text-slate-700">= Neto</span>
                    <span className="font-bold text-emerald-700">{formatCurrency(neto)}</span>
                  </div>
                </div>
              </div>

              {(puedePagar || (libramiento.pagado && canReadPagos) || montoPagado > 0.01) && (
                <div className="rounded-md border border-slate-200 bg-white px-3.5 py-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Acciones de pago
                  </div>
                  {puedePagar ? (
                    <Link
                      to={`/pagos?libramiento=${libramientoId}`}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
                    >
                      <Banknote size={16} />
                      {montoPagado > 0.01
                        ? `Registrar pago del saldo (${formatCurrency(saldoPendiente)})`
                        : 'Ir a registrar pago'}
                    </Link>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-600">
                        Este libramiento ya figura como pagado
                        {libramiento.fecha_pago
                          ? ` el ${formatDate(libramiento.fecha_pago)}`
                          : ''}
                        .
                      </p>
                      <Link
                        to="/pagos"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        <Receipt size={16} />
                        Ir al módulo de pagos
                      </Link>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-md border border-slate-200 bg-white px-3.5 py-3 text-sm">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <User size={13} />
                  Registro
                </div>
                <dl className="space-y-1.5 text-slate-600">
                  {libramiento.usuario_creacion_nombre && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Creado por</dt>
                      <dd className="text-right font-medium text-slate-800">
                        {libramiento.usuario_creacion_nombre}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Registrado</dt>
                    <dd className="text-right tabular-nums">
                      {new Date(libramiento.created_at).toLocaleString('es-AR')}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Actualizado</dt>
                    <dd className="text-right tabular-nums">
                      {new Date(libramiento.updated_at).toLocaleString('es-AR')}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </SpreadsheetShell>

      <SpreadsheetSection
        title="Detalle de cuentas"
        toolbar={
          <span className="text-xs tabular-nums text-slate-500">
            {cuentasCount} {cuentasCount === 1 ? 'línea' : 'líneas'}
          </span>
        }
      >
        <SpreadsheetGrid
          columns={detalleColumns}
          data={libramiento.detalle ?? []}
          rowKey={(line) => line.id}
          showRowNumbers
          emptyMessage="Sin cuentas en el detalle"
        />
        {cuentasCount > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-x-8 gap-y-2 border-t border-slate-300 bg-[#f1f5f9] px-4 py-2.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Bruto</span>
              <span className="font-semibold tabular-nums text-slate-800">
                {formatCurrency(importe)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Retenciones</span>
              <span className="font-semibold tabular-nums text-amber-800">
                {formatCurrency(retenciones)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-600">Neto</span>
              <span className="text-base font-bold tabular-nums text-emerald-700">
                {formatCurrency(neto)}
              </span>
            </div>
          </div>
        )}
      </SpreadsheetSection>

      {canReadPagos && pagosActivos.length > 0 && (
        <SpreadsheetSection
          title="Pagos registrados"
          toolbar={
            <span className="text-xs tabular-nums text-slate-500">
              {pagosActivos.length} {pagosActivos.length === 1 ? 'pago' : 'pagos'} · acumulado{' '}
              {formatCurrency(montoPagado)}
            </span>
          }
        >
          <div className="divide-y divide-slate-200">
            {pagosActivos.map((pago) => (
              <Link
                key={pago.id}
                to={`/pagos/${pago.id}`}
                state={returnState}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="font-mono text-sm font-semibold text-primary-800">
                    {pago.numero_completo}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {formatDate(pago.fecha_pago)} · {MEDIO_PAGO_LABELS[pago.medio_pago]}
                    {pago.numero_comprobante ? ` · Comp. ${pago.numero_comprobante}` : ''}
                  </div>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-emerald-700">
                  {formatCurrency(pago.monto)}
                </span>
              </Link>
            ))}
          </div>
        </SpreadsheetSection>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <SidePanel
          title="Documentos vinculados"
          icon={<FolderOpen size={15} className="text-slate-500" />}
        >
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link
                to={`/expedientes/${libramiento.expediente_id}`}
                state={returnState}
                className="group flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 transition hover:border-primary-300 hover:bg-primary-50/40"
              >
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Expediente
                  </div>
                  <div className="font-mono font-semibold text-primary-800 group-hover:underline">
                    {libramiento.expediente_numero || `#${libramiento.expediente_id}`}
                  </div>
                </div>
                <ExternalLink size={14} className="text-slate-400" />
              </Link>
            </li>
            <li>
              <Link
                to={`/afectaciones/${libramiento.afectacion_id}`}
                state={returnState}
                className="group flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 transition hover:border-primary-300 hover:bg-primary-50/40"
              >
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Afectación presupuestaria
                  </div>
                  <div className="font-mono font-semibold text-primary-800 group-hover:underline">
                    {libramiento.afectacion_numero || `#${libramiento.afectacion_id}`}
                  </div>
                </div>
                <ExternalLink size={14} className="text-slate-400" />
              </Link>
            </li>
          </ul>
        </SidePanel>

        <SidePanel
          title="Impresión"
          icon={<Printer size={15} className="text-slate-500" />}
        >
          <p className="mb-3 text-sm text-slate-600">
            El libramiento se imprime como overlay sobre el formulario preimpreso A4. Calibrá
            posiciones en Configuración → Impresiones → Libramientos.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={printing || downloadingPdf || libramiento.anulado}
              onClick={() => void print(libramientoId)}
            >
              <Printer size={14} />
              {printing ? 'Preparando...' : 'Imprimir'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={printing || downloadingPdf || libramiento.anulado}
              onClick={() => void downloadPdf(libramientoId)}
            >
              <Download size={14} />
              {downloadingPdf ? 'Generando...' : 'Descargar PDF'}
            </Button>
          </div>
        </SidePanel>
      </div>

      <Modal
        open={anularModal}
        onClose={() => setAnularModal(false)}
        title="Anular libramiento"
        size="sm"
      >
        {formError && (
          <div className="mb-4">
            <Alert type="error">{formError}</Alert>
          </div>
        )}
        <p className="mb-4 text-sm text-slate-600">
          Si es el único libramiento activo del expediente, este volverá a estado Afectado.
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
