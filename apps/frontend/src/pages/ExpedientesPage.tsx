import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Download,
  RotateCcw,
  Filter,
} from 'lucide-react';
import {
  getExpedientes,
  getExpedientesResumen,
  exportExpedientesCsv,
} from '@/services/expedientes.service';
import { NuevoExpedienteModal } from '@/components/expedientes/NuevoExpedienteModal';
import { EstadoExpedienteBadge } from '@/components/expedientes/EstadoExpedienteBadge';
import { PageListLayout } from '@/components/layout/PageListLayout';
import {
  SpreadsheetShell,
  SpreadsheetGrid,
  SpreadsheetStatusBar,
  SpreadsheetStatCards,
  SpreadsheetReloadButton,
  spreadsheet,
  type SpreadsheetColumn,
} from '@/components/spreadsheet';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatDate, labelTramiteExpediente } from '@/utils/format';
import type { Expediente } from '@/types';

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'INICIADO', label: 'Iniciado' },
  { value: 'AFECTADO', label: 'Afectado / Anticipado' },
  { value: 'LIBRADO', label: 'Librado' },
  { value: 'PAGADO', label: 'Pagado' },
  { value: 'ARCHIVADO', label: 'Archivado' },
];

const PAGE_SIZE = 20;

export function ExpedientesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const canWrite = useAuthStore((s) => s.hasPermission('expedientes:write'));

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 350);
  const [estadoFilter, setEstadoFilter] = useState('');
  const [anioFilter, setAnioFilter] = useState(String(new Date().getFullYear()));
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [modalOpen, setModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const filters = {
    search: search || undefined,
    estado: estadoFilter || undefined,
    anio: anioFilter ? Number(anioFilter) : undefined,
    fechaDesde: fechaDesde || undefined,
    fechaHasta: fechaHasta || undefined,
  };

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['expedientes', page, filters, sortBy, sortOrder],
    queryFn: () =>
      getExpedientes({ page, limit: PAGE_SIZE, ...filters, sortBy, sortOrder }),
  });

  const { data: resumen } = useQuery({
    queryKey: ['expedientes-resumen'],
    queryFn: () => getExpedientesResumen(),
  });

  useEffect(() => {
    setPage(1);
  }, [search]);

  // Deep-link: /expedientes?nuevo=1
  useEffect(() => {
    if (searchParams.get('nuevo') === '1' && canWrite) {
      setModalOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('nuevo');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, canWrite, setSearchParams]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handleEstadoCard = (estado: string) => {
    setEstadoFilter(estado);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setEstadoFilter('');
    setAnioFilter(String(new Date().getFullYear()));
    setFechaDesde('');
    setFechaHasta('');
    setPage(1);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportExpedientesCsv(filters);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;
  const rowOffset = (page - 1) * PAGE_SIZE;

  const columns: SpreadsheetColumn<Expediente>[] = [
    {
      key: 'numero',
      header: 'Número',
      sortable: true,
      width: 'w-28',
      render: (exp) => (
        <span className="font-mono font-semibold text-primary-800">{exp.numero_completo}</span>
      ),
    },
    {
      key: 'fecha_ingreso',
      header: 'Fecha ingreso',
      sortable: true,
      width: 'w-28',
      render: (exp) => <span className="tabular-nums">{formatDate(exp.fechaIngreso)}</span>,
    },
    {
      key: 'proveedor',
      header: 'Proveedores',
      render: (exp) => <span className="font-medium">{exp.proveedor_nombre}</span>,
    },
    {
      key: 'importe',
      header: 'Importe',
      sortable: true,
      width: 'w-32',
      align: 'right',
      render: (exp) => (
        <span className="font-medium tabular-nums">{formatCurrency(exp.importe)}</span>
      ),
    },
    {
      key: 'detalle',
      header: 'Detalle',
      className: 'max-w-xs truncate',
      render: (exp) => <span className="text-slate-600" title={exp.detalle}>{exp.detalle}</span>,
    },
    {
      key: 'tramite',
      header: 'Trámite',
      width: 'w-28',
      render: (exp) => {
        const label = labelTramiteExpediente(exp.circuito);
        if (label === 'Anticipo') {
          return (
            <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
              Anticipo
            </span>
          );
        }
        if (label === 'Afectación') {
          return (
            <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
              Afectación
            </span>
          );
        }
        return <span className="text-slate-400">—</span>;
      },
    },
    {
      key: 'afectaciones',
      header: 'Docs.',
      width: 'w-20',
      align: 'right',
      render: (exp) => {
        const n = (exp.afectaciones_activas ?? 0) + (exp.anticipos_activos ?? 0);
        return n > 0 ? (
          <span className="font-semibold tabular-nums text-amber-800">{n}</span>
        ) : (
          <span className="tabular-nums text-slate-400">0</span>
        );
      },
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      width: 'w-28',
      render: (exp) => (
        <EstadoExpedienteBadge
          estado={exp.estado}
          anulado={exp.anulado}
          circuito={exp.circuito}
        />
      ),
    },
  ];

  return (
    <>
    <PageListLayout
      collapsibleStats
      stats={
        resumen ? (
          <SpreadsheetStatCards
            activeId={estadoFilter}
            onSelect={handleEstadoCard}
            cards={[
              { id: '', label: 'Total', value: resumen.total, valueClassName: 'text-slate-800' },
              { id: 'INICIADO', label: 'Iniciado', value: resumen.porEstado.INICIADO ?? 0, valueClassName: 'text-blue-700' },
              { id: 'AFECTADO', label: 'Afectado / Anticipado', value: resumen.porEstado.AFECTADO ?? 0, valueClassName: 'text-amber-700' },
              { id: 'LIBRADO', label: 'Librado', value: resumen.porEstado.LIBRADO ?? 0, valueClassName: 'text-indigo-700' },
              { id: 'PAGADO', label: 'Pagado', value: resumen.porEstado.PAGADO ?? 0, valueClassName: 'text-emerald-700' },
              { id: 'ARCHIVADO', label: 'Archivado', value: resumen.porEstado.ARCHIVADO ?? 0, valueClassName: 'text-slate-600' },
            ]}
          />
        ) : undefined
      }
    >
      <SpreadsheetShell
        fillHeight
        title="Expedientes"
        actions={
          <>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-primary-100 transition-colors hover:bg-primary-800 hover:text-white disabled:opacity-50"
            >
              <Download size={16} />
              {exporting ? 'Exportando...' : 'Exportar'}
            </button>
            {canWrite && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
              >
                <Plus size={16} />
                Nuevo
              </button>
            )}
          </>
        }
        filters={
          <div className="flex w-full flex-wrap items-center gap-2.5">
            <Filter size={16} className="shrink-0 text-slate-400" />
            <div className="relative min-w-[220px] flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar número, proveedor o detalle..."
                className={`${spreadsheet.filterInput} w-full pl-9`}
              />
            </div>
            <select
              value={estadoFilter}
              onChange={(e) => { setEstadoFilter(e.target.value); setPage(1); }}
              className={spreadsheet.filterSelect}
              title="Estado"
            >
              {ESTADO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              type="number"
              value={anioFilter}
              onChange={(e) => { setAnioFilter(e.target.value); setPage(1); }}
              placeholder="Año"
              className={`${spreadsheet.filterInput} w-24`}
              title="Año"
            />
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => { setFechaDesde(e.target.value); setPage(1); }}
              className={spreadsheet.filterInput}
              title="Desde"
            />
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => { setFechaHasta(e.target.value); setPage(1); }}
              className={spreadsheet.filterInput}
              title="Hasta"
            />
            <SpreadsheetReloadButton onReload={() => refetch()} loading={isFetching} />
            <button type="button" onClick={handleClearFilters} className={spreadsheet.toolbarBtn}>
              <RotateCcw size={15} />
              Limpiar
            </button>
          </div>
        }
        footer={
          <SpreadsheetStatusBar
            left={
              data && (
                <>
                  <span>
                    <strong>{data.total}</strong> registro{data.total !== 1 ? 's' : ''}
                  </span>
                  <span className="text-slate-400">|</span>
                  <span>Mostrando {data.data.length > 0 ? rowOffset + 1 : 0}–{rowOffset + data.data.length}</span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-500">Clic en fila para ver detalle</span>
                </>
              )
            }
            page={page}
            totalPages={totalPages}
            canPrev={page > 1}
            canNext={page < totalPages}
            onPrevPage={() => setPage((p) => p - 1)}
            onNextPage={() => setPage((p) => p + 1)}
          />
        }
      >
        <SpreadsheetGrid
          columns={columns}
          data={data?.data ?? []}
          rowKey={(exp) => exp.id}
          loading={isLoading}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          onRowClick={(exp) => navigate(`/expedientes/${exp.id}`)}
          rowNumberOffset={rowOffset}
          emptyMessage="No hay expedientes con los filtros aplicados"
        />
      </SpreadsheetShell>
    </PageListLayout>

      <NuevoExpedienteModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}