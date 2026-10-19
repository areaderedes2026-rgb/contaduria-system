import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  FileSearch,
  BookOpen,
  User,
  List,
  BarChart3,
  ArrowRight,
  RotateCcw,
  Filter,
  ExternalLink,
} from 'lucide-react';
import {
  getConsultasResumen,
  buscarExpedienteTrazabilidad,
  getExpedienteTrazabilidad,
  getMovimientosPorCuenta,
  buscarPorBeneficiario,
  getMovimientosConsolidados,
  getEjecucionPresupuestaria,
  exportMovimientosCsv,
  exportEjecucionCsv,
} from '@/services/consultas.service';
import { getCuentas } from '@/services/cuentas.service';
import { PageListLayout } from '@/components/layout/PageListLayout';
import {
  SpreadsheetShell,
  SpreadsheetGrid,
  SpreadsheetStatusBar,
  SpreadsheetStatCards,
  SpreadsheetSection,
  SpreadsheetTitleActions,
  SpreadsheetReloadButton,
  StatusBadge,
  spreadsheet,
  type SpreadsheetColumn,
} from '@/components/spreadsheet';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { EstadoExpedienteBadge } from '@/components/expedientes/EstadoExpedienteBadge';
import {
  formatCurrency,
  formatDate,
  ESTADO_EXPEDIENTE_LABELS,
  TIPO_CUENTA_LABELS,
} from '@/utils/format';
import { MEDIO_PAGO_LABELS } from '@/services/pagos.service';
import type {
  ExpedienteTrazabilidad,
  EstadoExpediente,
  MovimientoCuenta,
  BeneficiarioItem,
  MovimientoConsolidado,
  EjecucionCuenta,
} from '@/types';
import { ApiClientError } from '@/services/api';

type Tab = 'trazabilidad' | 'cuenta' | 'beneficiario' | 'movimientos' | 'presupuesto';

const TABS: { id: Tab; label: string; icon: typeof FileSearch }[] = [
  { id: 'trazabilidad', label: 'Trazabilidad', icon: FileSearch },
  { id: 'cuenta', label: 'Por cuenta', icon: BookOpen },
  { id: 'beneficiario', label: 'Beneficiario', icon: User },
  { id: 'movimientos', label: 'Movimientos', icon: List },
  { id: 'presupuesto', label: 'Presupuesto', icon: BarChart3 },
];

const TIPO_MOV_LABELS: Record<string, string> = {
  EXPEDIENTE: 'Expediente',
  AFECTACION: 'Afectación',
  LIBRAMIENTO: 'Libramiento',
  PAGO: 'Pago',
};

const VALID_TABS = new Set<Tab>(TABS.map((t) => t.id));

function documentoPath(tipo: string, id: number): string {
  switch (tipo) {
    case 'EXPEDIENTE':
      return `/expedientes/${id}`;
    case 'AFECTACION':
      return `/afectaciones/${id}`;
    case 'LIBRAMIENTO':
      return `/libramientos/${id}`;
    case 'PAGO':
      return `/pagos/${id}`;
    default:
      return '#';
  }
}

function EstadoConsultaBadge({ estado }: { estado: string }) {
  const upper = estado.toUpperCase();
  if (upper.includes('ANUL')) return <StatusBadge label={estado} variant="danger" />;
  if (upper === 'PAGADO' || upper === 'VIGENTE' || upper === 'ACTIVA' || upper === 'ACTIVO') {
    return <StatusBadge label={estado} variant="success" />;
  }
  if (upper === 'PENDIENTE' || upper.includes('PROCESO')) {
    return <StatusBadge label={estado} variant="warning" />;
  }
  if (ESTADO_EXPEDIENTE_LABELS[estado]) {
    return (
      <EstadoExpedienteBadge estado={estado as EstadoExpediente} />
    );
  }
  return <StatusBadge label={estado} variant="info" />;
}

export function ConsultasPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab: Tab =
    tabParam && VALID_TABS.has(tabParam as Tab) ? (tabParam as Tab) : 'trazabilidad';
  const [tab, setTab] = useState<Tab>(initialTab);

  const { data: resumen } = useQuery({
    queryKey: ['consultas-resumen'],
    queryFn: getConsultasResumen,
  });

  useEffect(() => {
    const next = searchParams.get('tab');
    if (next && VALID_TABS.has(next as Tab) && next !== tab) {
      setTab(next as Tab);
    }
  }, [searchParams, tab]);

  const changeTab = (next: Tab) => {
    setTab(next);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', next);
    // Limpiar params específicos de otras vistas al cambiar de tab
    if (next !== 'trazabilidad') {
      nextParams.delete('numero');
      nextParams.delete('anio');
      nextParams.delete('expediente');
    }
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <PageListLayout
      collapsibleStats
      stats={
        resumen ? (
          <SpreadsheetStatCards
            cards={[
              {
                id: 'activos',
                label: 'Expedientes activos',
                value: resumen.expedientesActivos,
                valueClassName: 'text-slate-800',
              },
              {
                id: 'proceso',
                label: 'En proceso',
                value: resumen.enProceso,
                valueClassName: 'text-amber-700',
              },
              {
                id: 'pagados',
                label: 'Pagados',
                value: resumen.pagados,
                valueClassName: 'text-emerald-700',
              },
              {
                id: 'archivados',
                label: 'Archivados',
                value: resumen.archivados,
                valueClassName: 'text-slate-600',
              },
              {
                id: 'monto-afectado',
                label: 'Monto afectado',
                value: resumen.montoAfectado,
                displayValue: formatCurrency(resumen.montoAfectado),
                valueClassName: 'text-amber-700',
              },
              {
                id: 'monto-pagado',
                label: 'Monto pagado',
                value: resumen.montoPagado,
                displayValue: formatCurrency(resumen.montoPagado),
                valueClassName: 'text-emerald-700',
              },
            ]}
          />
        ) : undefined
      }
    >
      <SpreadsheetShell fillHeight title="Consultas">
        <div className="border-b border-slate-300 bg-white">
          <div className="flex flex-wrap gap-1 px-3">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => changeTab(t.id)}
                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <t.icon size={16} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {tab === 'trazabilidad' && <TrazabilidadTab />}
          {tab === 'cuenta' && <CuentaTab />}
          {tab === 'beneficiario' && <BeneficiarioTab />}
          {tab === 'movimientos' && <MovimientosTab />}
          {tab === 'presupuesto' && <PresupuestoTab />}
        </div>
      </SpreadsheetShell>
    </PageListLayout>
  );
}

function TrazabilidadTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [numero, setNumero] = useState(searchParams.get('numero') ?? '');
  const [anio, setAnio] = useState(
    searchParams.get('anio') ?? String(new Date().getFullYear())
  );
  const [error, setError] = useState('');
  const [data, setData] = useState<ExpedienteTrazabilidad | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoDone, setAutoDone] = useState(false);

  const loadByNumeroAnio = async (n: number, a: number) => {
    setError('');
    setData(null);
    setLoading(true);
    try {
      const result = await buscarExpedienteTrazabilidad(n, a);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Expediente no encontrado');
    } finally {
      setLoading(false);
    }
  };

  const loadById = async (id: number) => {
    setError('');
    setData(null);
    setLoading(true);
    try {
      const result = await getExpedienteTrazabilidad(id);
      setData(result);
      setNumero(String(result.expediente.numero));
      setAnio(String(result.expediente.anio));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Expediente no encontrado');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoDone) return;
    const expedienteId = searchParams.get('expediente');
    const n = searchParams.get('numero');
    const a = searchParams.get('anio');
    if (expedienteId) {
      const id = Number(expedienteId);
      if (!Number.isNaN(id)) {
        void loadById(id);
        setAutoDone(true);
        return;
      }
    }
    if (n && a) {
      void loadByNumeroAnio(Number(n), Number(a));
      setAutoDone(true);
    }
  }, [searchParams, autoDone]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numero) {
      setError('Ingrese el número de expediente');
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'trazabilidad');
    next.set('numero', numero);
    next.set('anio', anio);
    next.delete('expediente');
    setSearchParams(next, { replace: true });
    await loadByNumeroAnio(Number(numero), Number(anio));
  };

  const detalleColumns: SpreadsheetColumn<{
    cuenta_codigo: string;
    cuenta_descripcion?: string;
    descripcion: string;
    importe: number;
  }>[] = [
    {
      key: 'cuenta',
      header: 'Cuenta',
      width: 'w-32',
      render: (d) => <span className="font-mono text-primary-800">{d.cuenta_codigo}</span>,
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      render: (d) => <span className="text-slate-600">{d.descripcion}</span>,
    },
    {
      key: 'importe',
      header: 'Importe',
      width: 'w-32',
      align: 'right',
      render: (d) => (
        <span className="font-medium tabular-nums">{formatCurrency(d.importe)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <SpreadsheetSection title="Búsqueda de expediente">
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Número</label>
            <input
              type="number"
              min="1"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              className={spreadsheet.filterInput}
              placeholder="Ej: 1"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Año</label>
            <input
              type="number"
              value={anio}
              onChange={(e) => setAnio(e.target.value)}
              className={`${spreadsheet.filterInput} w-24`}
            />
          </div>
          <Button type="submit" loading={loading}>
            <Search size={16} /> Consultar
          </Button>
          {(data || error) && (
            <button
              type="button"
              onClick={() => {
                setData(null);
                setError('');
                setNumero('');
                setAnio(String(new Date().getFullYear()));
                const next = new URLSearchParams(searchParams);
                next.delete('numero');
                next.delete('anio');
                next.delete('expediente');
                setSearchParams(next, { replace: true });
              }}
              className={spreadsheet.toolbarBtn}
            >
              <RotateCcw size={15} />
              Limpiar
            </button>
          )}
        </form>
        {error && (
          <div className="border-t border-slate-200 px-4 pb-4">
            <Alert type="error">{error}</Alert>
          </div>
        )}
      </SpreadsheetSection>

      {data && (
        <div className="space-y-4">
          <SpreadsheetSection title={`Expediente ${data.expediente.numero_completo}`}>
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <EstadoExpedienteBadge
                  estado={data.expediente.estado as EstadoExpediente}
                  anulado={data.expediente.anulado}
                />
                <span className="text-sm text-slate-500">
                  {formatDate(data.expediente.fechaIngreso)}
                </span>
                <span className="font-medium">{data.expediente.proveedor_nombre}</span>
                <span className="font-medium tabular-nums text-primary-800">
                  {formatCurrency(data.expediente.importe)}
                </span>
                <Link
                  to={`/expedientes/${data.expediente.id}`}
                  className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
                >
                  Ver detalle <ExternalLink size={12} />
                </Link>
              </div>
              <p className="mt-2 text-sm text-slate-600">{data.expediente.detalle}</p>
            </div>
          </SpreadsheetSection>

          <div className="flex flex-wrap items-center gap-2 px-1 text-sm">
            {['Afectación', 'Libramiento', 'Pago'].map((step, i) => (
              <span key={step} className="flex items-center gap-2">
                <span
                  className={`rounded-lg px-3 py-1.5 font-medium ${
                    (step === 'Afectación' && data.afectaciones.some((a) => !a.anulada)) ||
                    (step === 'Libramiento' && data.libramientos.some((l) => !l.anulado)) ||
                    (step === 'Pago' && data.pagos.some((p) => !p.anulado))
                      ? 'bg-primary-100 text-primary-800'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {step}
                </span>
                {i < 2 && <ArrowRight size={14} className="text-slate-300" />}
              </span>
            ))}
          </div>

          {data.afectaciones.length === 0 &&
            data.libramientos.length === 0 &&
            data.pagos.length === 0 && (
              <Alert type="info">Este expediente aún no tiene documentos vinculados.</Alert>
            )}

          {data.afectaciones.map((af) => (
            <SpreadsheetSection
              key={af.id}
              title={`Afectación ${af.numero_completo}`}
              toolbar={
                <Link
                  to={`/afectaciones/${af.id}`}
                  className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
                >
                  Ver detalle <ExternalLink size={11} />
                </Link>
              }
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2 text-sm">
                <StatusBadge
                  label={af.anulada ? 'Anulada' : 'Activa'}
                  variant={af.anulada ? 'danger' : 'success'}
                />
                <span className="text-slate-400">|</span>
                <span className="tabular-nums">{formatDate(af.fecha)}</span>
                <span className="text-slate-400">|</span>
                <span className="font-medium tabular-nums text-amber-800">
                  {formatCurrency(af.importe_total)}
                </span>
                <span className="text-slate-500">— {af.destinatario}</span>
                {af.numero_comprobante ? (
                  <>
                    <span className="text-slate-400">|</span>
                    <span className="font-mono text-slate-600">
                      Comp. {af.numero_comprobante}
                    </span>
                  </>
                ) : null}
              </div>
              {af.detalle.length > 0 && (
                <SpreadsheetGrid
                  columns={detalleColumns}
                  data={af.detalle}
                  rowKey={(d) => `${af.id}-${d.cuenta_codigo}-${d.descripcion}-${d.importe}`}
                  showRowNumbers={false}
                  emptyMessage="Sin detalle"
                />
              )}
            </SpreadsheetSection>
          ))}

          {data.libramientos.map((lib) => (
            <SpreadsheetSection
              key={lib.id}
              title={`Libramiento ${lib.numero_completo}`}
              toolbar={
                <Link
                  to={`/libramientos/${lib.id}`}
                  className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
                >
                  Ver detalle <ExternalLink size={11} />
                </Link>
              }
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2 text-sm">
                <StatusBadge
                  label={lib.anulado ? 'Anulado' : lib.pagado ? 'Pagado' : 'Activo'}
                  variant={lib.anulado ? 'danger' : lib.pagado ? 'info' : 'success'}
                />
                <span className="text-slate-400">|</span>
                <span className="tabular-nums">{formatDate(lib.fecha)}</span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-600">{lib.beneficiario}</span>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-3">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Bruto</div>
                  <div className="font-medium tabular-nums">{formatCurrency(lib.importe)}</div>
                </div>
                <div className="rounded-md border border-slate-200 bg-amber-50/60 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-amber-800/80">
                    Retenciones
                  </div>
                  <div className="font-medium tabular-nums text-amber-900">
                    {formatCurrency(lib.retenciones)}
                  </div>
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-emerald-800/80">Neto</div>
                  <div className="font-bold tabular-nums text-emerald-800">
                    {formatCurrency(lib.neto)}
                  </div>
                </div>
              </div>
              {lib.detalle.length > 0 && (
                <SpreadsheetGrid
                  columns={detalleColumns}
                  data={lib.detalle}
                  rowKey={(d) => `${lib.id}-${d.cuenta_codigo}-${d.descripcion}-${d.importe}`}
                  showRowNumbers={false}
                  emptyMessage="Sin detalle"
                />
              )}
            </SpreadsheetSection>
          ))}

          {data.pagos.map((p) => (
            <SpreadsheetSection
              key={p.id}
              title={`Pago ${p.numero_completo}`}
              toolbar={
                <Link
                  to={`/pagos/${p.id}`}
                  className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
                >
                  Ver detalle <ExternalLink size={11} />
                </Link>
              }
            >
              <div className="flex flex-wrap items-center gap-2 p-4 text-sm">
                <StatusBadge
                  label={p.anulado ? 'Anulado' : 'Vigente'}
                  variant={p.anulado ? 'danger' : 'success'}
                />
                <span className="text-slate-400">|</span>
                <span className="tabular-nums">{formatDate(p.fecha_pago)}</span>
                <span className="text-slate-400">|</span>
                <span className="font-medium tabular-nums text-emerald-700">
                  {formatCurrency(p.monto)}
                </span>
                <span className="text-slate-400">|</span>
                <span>
                  {MEDIO_PAGO_LABELS[p.medio_pago as keyof typeof MEDIO_PAGO_LABELS] ??
                    p.medio_pago}
                </span>
                <span className="text-slate-500">— {p.beneficiario}</span>
              </div>
            </SpreadsheetSection>
          ))}

          {data.historial.length > 0 && (
            <SpreadsheetSection title="Historial del expediente">
              <div className="space-y-2 p-4">
                {data.historial.map((h) => (
                  <div
                    key={h.id}
                    className="flex flex-wrap gap-x-3 gap-y-1 border-b border-slate-200 pb-2 text-sm last:border-0"
                  >
                    <span className="font-medium text-primary-700">{h.accion}</span>
                    {h.estado_anterior && h.estado_nuevo && (
                      <span className="text-slate-500">
                        {ESTADO_EXPEDIENTE_LABELS[h.estado_anterior] ?? h.estado_anterior} →{' '}
                        {ESTADO_EXPEDIENTE_LABELS[h.estado_nuevo] ?? h.estado_nuevo}
                      </span>
                    )}
                    {h.usuario_nombre && (
                      <span className="text-slate-500">por {h.usuario_nombre}</span>
                    )}
                    <span className="text-slate-400">
                      {new Date(h.created_at).toLocaleString('es-AR')}
                    </span>
                    {h.observacion && (
                      <span className="w-full text-slate-600">{h.observacion}</span>
                    )}
                  </div>
                ))}
              </div>
            </SpreadsheetSection>
          )}
        </div>
      )}
    </div>
  );
}

function CuentaTab() {
  const navigate = useNavigate();
  const [cuentaId, setCuentaId] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const { data: cuentas } = useQuery({
    queryKey: ['cuentas-consulta'],
    queryFn: () =>
      getCuentas({ limit: 500, estado: 'ACTIVA', sortBy: 'codigo', sortOrder: 'asc' }),
  });

  const {
    data: movimientos,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['movimientos-cuenta', cuentaId, fechaDesde, fechaHasta],
    queryFn: () =>
      getMovimientosPorCuenta(
        Number(cuentaId),
        fechaDesde || undefined,
        fechaHasta || undefined
      ),
    enabled: false,
  });

  const columns: SpreadsheetColumn<MovimientoCuenta>[] = [
    {
      key: 'tipo',
      header: 'Tipo',
      width: 'w-28',
      render: (m) => TIPO_MOV_LABELS[m.tipo] ?? m.tipo,
    },
    {
      key: 'fecha',
      header: 'Fecha',
      width: 'w-28',
      render: (m) => <span className="tabular-nums">{formatDate(m.fecha)}</span>,
    },
    {
      key: 'documento',
      header: 'Documento',
      render: (m) => (
        <Link
          to={documentoPath(m.tipo, m.documento_id)}
          className="inline-flex items-center gap-1 font-mono text-primary-700 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {m.documento_numero}
          <ExternalLink size={11} className="opacity-60" />
        </Link>
      ),
    },
    {
      key: 'expediente',
      header: 'Expediente',
      render: (m) => (
        <Link
          to={`/expedientes/${m.expediente_id}`}
          className="font-mono text-primary-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {m.expediente_numero}
        </Link>
      ),
    },
    {
      key: 'beneficiario',
      header: 'Beneficiario',
      render: (m) => <span className="text-slate-700">{m.beneficiario}</span>,
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      render: (m) => <span className="text-slate-600">{m.descripcion}</span>,
    },
    {
      key: 'importe',
      header: 'Importe',
      width: 'w-32',
      align: 'right',
      render: (m) => (
        <span className="font-medium tabular-nums">{formatCurrency(m.importe)}</span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: 'w-24',
      render: (m) => (
        <StatusBadge
          label={m.anulado ? 'Anulado' : 'Vigente'}
          variant={m.anulado ? 'danger' : 'success'}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <SpreadsheetSection title="Filtros">
        <div className="flex flex-wrap items-end gap-3 p-4">
          <Filter size={16} className="mb-2 shrink-0 text-slate-400" />
          <div className="min-w-[280px] flex-1">
            <Select
              label="Cuenta presupuestaria"
              value={cuentaId}
              onChange={(e) => setCuentaId(e.target.value)}
              options={[
                { value: '', label: 'Seleccionar cuenta...' },
                ...(cuentas?.data.map((c) => ({
                  value: c.id,
                  label: `${c.codigo} — ${c.descripcion}`,
                })) ?? []),
              ]}
            />
          </div>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className={spreadsheet.filterInput}
            title="Desde"
          />
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className={spreadsheet.filterInput}
            title="Hasta"
          />
          <Button disabled={!cuentaId} loading={isFetching} onClick={() => refetch()}>
            <Search size={16} /> Consultar
          </Button>
          <button
            type="button"
            onClick={() => {
              setCuentaId('');
              setFechaDesde('');
              setFechaHasta('');
            }}
            className={spreadsheet.toolbarBtn}
          >
            <RotateCcw size={15} />
            Limpiar
          </button>
        </div>
      </SpreadsheetSection>

      {movimientos && (
        <SpreadsheetSection
          title="Movimientos por cuenta"
          toolbar={
            <span className="text-xs text-slate-500 tabular-nums">
              {movimientos.length} movimiento{movimientos.length !== 1 ? 's' : ''}
            </span>
          }
        >
          <SpreadsheetGrid
            columns={columns}
            data={movimientos}
            rowKey={(m) => `${m.tipo}-${m.documento_id}-${m.descripcion}-${m.importe}`}
            loading={isLoading}
            emptyMessage="Sin movimientos para la cuenta y período seleccionados"
            onRowClick={(m) => navigate(documentoPath(m.tipo, m.documento_id))}
          />
        </SpreadsheetSection>
      )}
    </div>
  );
}

function BeneficiarioTab() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 350);
  const [tipo, setTipo] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['beneficiario', search, tipo, page],
    queryFn: () => buscarPorBeneficiario(search, page, PAGE_SIZE, tipo || undefined),
    enabled: search.length >= 2,
  });

  useEffect(() => {
    setPage(1);
  }, [search, tipo]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;
  const rowOffset = (page - 1) * PAGE_SIZE;

  const columns: SpreadsheetColumn<BeneficiarioItem>[] = [
    {
      key: 'tipo',
      header: 'Tipo',
      width: 'w-28',
      render: (item) => TIPO_MOV_LABELS[item.tipo] ?? item.tipo,
    },
    {
      key: 'numero',
      header: 'Número',
      render: (item) => (
        <Link
          to={documentoPath(item.tipo, item.id)}
          className="font-mono font-semibold text-primary-800 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {item.numero_completo}
        </Link>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      width: 'w-28',
      render: (item) => <span className="tabular-nums">{formatDate(item.fecha)}</span>,
    },
    {
      key: 'beneficiario',
      header: 'Beneficiario',
      render: (item) => <span className="font-medium">{item.beneficiario}</span>,
    },
    {
      key: 'expediente',
      header: 'Expediente',
      render: (item) => (
        <Link
          to={`/expedientes/${item.expediente_id}`}
          className="font-mono text-primary-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {item.expediente_numero}
        </Link>
      ),
    },
    {
      key: 'monto',
      header: 'Monto',
      width: 'w-32',
      align: 'right',
      render: (item) => (
        <span className="tabular-nums">
          {item.monto > 0 ? formatCurrency(item.monto) : '—'}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: 'w-28',
      render: (item) => <EstadoConsultaBadge estado={item.estado} />,
    },
  ];

  return (
    <div className="space-y-4">
      <SpreadsheetSection title="Búsqueda por beneficiario">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <Filter size={16} className="shrink-0 text-slate-400" />
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className={spreadsheet.filterSelect}
            title="Filtrar por tipo de documento"
          >
            <option value="">Todos los tipos</option>
            {Object.entries(TIPO_MOV_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <div className="relative min-w-[260px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Nombre de beneficiario, destinatario o proveedor..."
              className={`${spreadsheet.filterInput} w-full pl-9`}
            />
          </div>
          <SpreadsheetReloadButton
            onReload={() => refetch()}
            loading={isFetching}
          />
          <button
            type="button"
            onClick={() => {
              setSearchInput('');
              setTipo('');
              setPage(1);
            }}
            className={spreadsheet.toolbarBtn}
          >
            <RotateCcw size={15} />
            Limpiar
          </button>
        </div>
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
          Busca expedientes, afectaciones, libramientos y pagos. Filtrá por tipo si querés ver solo
          uno. Resultados desde 2 caracteres; clic en la fila abre el documento.
        </p>
      </SpreadsheetSection>

      {error && <Alert type="error">Error en la búsqueda</Alert>}

      {search.length >= 2 && (
        <SpreadsheetSection
          title={tipo ? `Resultados · ${TIPO_MOV_LABELS[tipo] ?? tipo}` : 'Resultados'}
          toolbar={
            data && data.total > 0 ? (
              <span className="text-xs text-slate-500 tabular-nums">
                {data.total} resultado{data.total !== 1 ? 's' : ''}
              </span>
            ) : undefined
          }
        >
          <SpreadsheetGrid
            columns={columns}
            data={data?.data ?? []}
            rowKey={(item) => `${item.tipo}-${item.id}`}
            loading={isLoading}
            rowNumberOffset={rowOffset}
            emptyMessage="Sin resultados para esa búsqueda"
            onRowClick={(item) => navigate(documentoPath(item.tipo, item.id))}
          />
          {data && data.total > 0 && (
            <div className={spreadsheet.statusBar}>
              <SpreadsheetStatusBar
                left={
                  <span>
                    Página {page} de {totalPages}
                  </span>
                }
                page={page}
                totalPages={totalPages}
                canPrev={page > 1}
                canNext={page < totalPages}
                onPrevPage={() => setPage((p) => p - 1)}
                onNextPage={() => setPage((p) => p + 1)}
              />
            </div>
          )}
        </SpreadsheetSection>
      )}
    </div>
  );
}

function MovimientosTab() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [tipo, setTipo] = useState('');
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 350);
  const [exporting, setExporting] = useState(false);
  const PAGE_SIZE = 20;

  const filters = {
    tipo: tipo || undefined,
    anio: anio ? Number(anio) : undefined,
    fechaDesde: fechaDesde || undefined,
    fechaHasta: fechaHasta || undefined,
    search: search || undefined,
  };

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['movimientos-consolidados', page, filters],
    queryFn: () => getMovimientosConsolidados({ page, limit: PAGE_SIZE, ...filters }),
  });

  useEffect(() => {
    setPage(1);
  }, [tipo, anio, fechaDesde, fechaHasta, search]);

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportMovimientosCsv(filters);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  const handleClear = () => {
    setTipo('');
    setAnio(String(new Date().getFullYear()));
    setFechaDesde('');
    setFechaHasta('');
    setSearchInput('');
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;
  const rowOffset = (page - 1) * PAGE_SIZE;

  const columns: SpreadsheetColumn<MovimientoConsolidado>[] = [
    {
      key: 'tipo',
      header: 'Tipo',
      width: 'w-28',
      render: (m) => TIPO_MOV_LABELS[m.tipo] ?? m.tipo,
    },
    {
      key: 'numero',
      header: 'Número',
      render: (m) => (
        <Link
          to={documentoPath(m.tipo, m.id)}
          className="font-mono font-semibold text-primary-800 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {m.numero_completo}
        </Link>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      width: 'w-28',
      render: (m) => <span className="tabular-nums">{formatDate(m.fecha)}</span>,
    },
    {
      key: 'beneficiario',
      header: 'Beneficiario',
      render: (m) => <span className="font-medium">{m.beneficiario}</span>,
    },
    {
      key: 'expediente',
      header: 'Expediente',
      render: (m) => (
        <Link
          to={`/expedientes/${m.expediente_id}`}
          className="font-mono text-primary-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {m.expediente_numero}
        </Link>
      ),
    },
    {
      key: 'monto',
      header: 'Monto',
      width: 'w-32',
      align: 'right',
      render: (m) => (
        <span className="font-medium tabular-nums">
          {m.monto > 0 ? formatCurrency(m.monto) : '—'}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: 'w-28',
      render: (m) => <EstadoConsultaBadge estado={m.estado} />,
    },
  ];

  return (
    <div className="space-y-4">
      <SpreadsheetSection
        title="Movimientos consolidados"
        toolbar={
          <SpreadsheetTitleActions
            onExport={handleExport}
            exporting={exporting}
            exportLabel="Exportar CSV"
          />
        }
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
          <Filter size={16} className="shrink-0 text-slate-400" />
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className={spreadsheet.filterSelect}
          >
            <option value="">Todos los tipos</option>
            {Object.entries(TIPO_MOV_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={anio}
            onChange={(e) => setAnio(e.target.value)}
            placeholder="Año"
            className={`${spreadsheet.filterInput} w-24`}
            title="Año"
          />
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className={spreadsheet.filterInput}
            title="Desde"
          />
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className={spreadsheet.filterInput}
            title="Hasta"
          />
          <div className="relative min-w-[200px] flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar número, expediente o beneficiario..."
              className={`${spreadsheet.filterInput} w-full pl-9`}
            />
          </div>
          <SpreadsheetReloadButton onReload={() => refetch()} loading={isFetching} />
          <button type="button" onClick={handleClear} className={spreadsheet.toolbarBtn}>
            <RotateCcw size={15} />
            Limpiar
          </button>
        </div>
        <SpreadsheetGrid
          columns={columns}
          data={data?.data ?? []}
          rowKey={(m) => `${m.tipo}-${m.id}`}
          loading={isLoading}
          rowNumberOffset={rowOffset}
          emptyMessage="Sin movimientos con los filtros aplicados"
          onRowClick={(m) => navigate(documentoPath(m.tipo, m.id))}
        />
        {data && (
          <div className={spreadsheet.statusBar}>
            <SpreadsheetStatusBar
              left={
                <>
                  <span>
                    <strong>{data.total}</strong> movimiento{data.total !== 1 ? 's' : ''}
                  </span>
                  <span className="text-slate-400">|</span>
                  <span>
                    Mostrando {data.data.length > 0 ? rowOffset + 1 : 0}–
                    {rowOffset + data.data.length}
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-500">Clic en fila para abrir</span>
                </>
              }
              page={page}
              totalPages={totalPages}
              canPrev={page > 1}
              canNext={page < totalPages}
              onPrevPage={() => setPage((p) => p - 1)}
              onNextPage={() => setPage((p) => p + 1)}
            />
          </div>
        )}
      </SpreadsheetSection>
    </div>
  );
}

function PresupuestoTab() {
  const navigate = useNavigate();
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [exporting, setExporting] = useState(false);
  const anioNum = anio ? Number(anio) : undefined;

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['ejecucion-presupuestaria', anioNum],
    queryFn: () => getEjecucionPresupuestaria(anioNum),
  });

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportEjecucionCsv(anioNum);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  const totales = data?.reduce(
    (acc, c) => ({
      inicial: acc.inicial + c.saldo_inicial,
      afectado: acc.afectado + c.saldo_afectado,
      disponible: acc.disponible + c.saldo_disponible,
      pagado: acc.pagado + c.monto_pagado,
    }),
    { inicial: 0, afectado: 0, disponible: 0, pagado: 0 }
  );

  const columns: SpreadsheetColumn<EjecucionCuenta>[] = [
    {
      key: 'codigo',
      header: 'Código',
      width: 'w-28',
      render: (c) => (
        <Link
          to={`/plan-cuentas/${c.id}`}
          className="font-mono text-primary-800 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {c.codigo}
        </Link>
      ),
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      render: (c) => <span className="text-slate-600">{c.descripcion}</span>,
    },
    {
      key: 'tipo',
      header: 'Tipo',
      width: 'w-28',
      render: (c) => TIPO_CUENTA_LABELS[c.tipo] ?? c.tipo,
    },
    {
      key: 'inicial',
      header: 'Presupuesto',
      width: 'w-32',
      align: 'right',
      render: (c) => <span className="tabular-nums">{formatCurrency(c.saldo_inicial)}</span>,
    },
    {
      key: 'afectado',
      header: 'Afectado',
      width: 'w-32',
      align: 'right',
      render: (c) => (
        <span className="tabular-nums text-amber-700">{formatCurrency(c.saldo_afectado)}</span>
      ),
    },
    {
      key: 'disponible',
      header: 'Disponible',
      width: 'w-32',
      align: 'right',
      render: (c) => (
        <span className="tabular-nums text-blue-700">{formatCurrency(c.saldo_disponible)}</span>
      ),
    },
    {
      key: 'pagado',
      header: 'Pagado',
      width: 'w-32',
      align: 'right',
      render: (c) => (
        <span className="tabular-nums text-emerald-700">{formatCurrency(c.monto_pagado)}</span>
      ),
    },
    {
      key: 'ejec',
      header: '% Ejec.',
      width: 'w-24',
      align: 'right',
      render: (c) => (
        <span className="font-medium tabular-nums">{c.porcentaje_ejecutado.toFixed(1)}%</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {totales && (
        <SpreadsheetStatCards
          cards={[
            {
              id: 'inicial',
              label: 'Presupuesto',
              value: totales.inicial,
              displayValue: formatCurrency(totales.inicial),
              valueClassName: 'text-slate-800',
            },
            {
              id: 'afectado',
              label: 'Afectado',
              value: totales.afectado,
              displayValue: formatCurrency(totales.afectado),
              valueClassName: 'text-amber-700',
            },
            {
              id: 'disponible',
              label: 'Disponible',
              value: totales.disponible,
              displayValue: formatCurrency(totales.disponible),
              valueClassName: 'text-blue-700',
            },
            {
              id: 'pagado',
              label: anio ? `Pagado ${anio}` : 'Pagado',
              value: totales.pagado,
              displayValue: formatCurrency(totales.pagado),
              valueClassName: 'text-emerald-700',
            },
          ]}
        />
      )}

      <SpreadsheetSection
        title="Ejecución presupuestaria"
        toolbar={
          <SpreadsheetTitleActions
            onExport={handleExport}
            exporting={exporting}
            exportLabel="Exportar CSV"
          />
        }
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
          <Filter size={16} className="shrink-0 text-slate-400" />
          <input
            type="number"
            value={anio}
            onChange={(e) => setAnio(e.target.value)}
            placeholder="Año (pagado)"
            className={`${spreadsheet.filterInput} w-28`}
            title="Filtra el monto pagado por año"
          />
          <span className="text-xs text-slate-400">
            El año filtra el monto pagado; los saldos son los actuales del plan.
          </span>
          <SpreadsheetReloadButton onReload={() => refetch()} loading={isFetching} />
          <button
            type="button"
            onClick={() => setAnio(String(new Date().getFullYear()))}
            className={spreadsheet.toolbarBtn}
          >
            <RotateCcw size={15} />
            Año actual
          </button>
        </div>
        <SpreadsheetGrid
          columns={columns}
          data={data ?? []}
          rowKey={(c) => c.id}
          loading={isLoading}
          emptyMessage="Sin datos de ejecución"
          onRowClick={(c) => navigate(`/plan-cuentas/${c.id}`)}
        />
      </SpreadsheetSection>
    </div>
  );
}
