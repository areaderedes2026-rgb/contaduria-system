import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, RotateCcw, Filter } from 'lucide-react';
import {
  getPagos,
  getPagosResumen,
  exportPagosCsv,
  MEDIO_PAGO_LABELS,
} from '@/services/pagos.service';
import {
  SpreadsheetShell,
  SpreadsheetGrid,
  SpreadsheetStatusBar,
  SpreadsheetStatCards,
  SpreadsheetTitleActions,
  SpreadsheetReloadButton,
  StatusBadge,
  spreadsheet,
  type SpreadsheetColumn,
} from '@/components/spreadsheet';
import { PageListLayout } from '@/components/layout/PageListLayout';
import { NuevoPagoModal } from '@/components/pagos/NuevoPagoModal';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatDate } from '@/utils/format';
import type { MedioPago, Pago } from '@/types';

const PAGE_SIZE = 20;
const currentYear = String(new Date().getFullYear());

const medioOptions = (Object.keys(MEDIO_PAGO_LABELS) as MedioPago[]).map((k) => ({
  value: k,
  label: MEDIO_PAGO_LABELS[k],
}));

export function PagosPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const canWrite = useAuthStore((s) => s.hasPermission('pagos:write'));

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 350);
  const [anioFilter, setAnioFilter] = useState(currentYear);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [medioFilter, setMedioFilter] = useState('');
  const [anuladoFilter, setAnuladoFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [modalOpen, setModalOpen] = useState(false);
  const [initialLibramientoId, setInitialLibramientoId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const filters = {
    search: search || undefined,
    anio: anioFilter ? Number(anioFilter) : undefined,
    fechaDesde: fechaDesde || undefined,
    fechaHasta: fechaHasta || undefined,
    medioPago: medioFilter || undefined,
    anulado:
      anuladoFilter === 'true' ? true : anuladoFilter === 'false' ? false : undefined,
  };

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['pagos', page, filters, sortBy, sortOrder],
    queryFn: () => getPagos({ page, limit: PAGE_SIZE, ...filters, sortBy, sortOrder }),
  });

  const { data: resumen } = useQuery({
    queryKey: ['pagos-resumen'],
    queryFn: getPagosResumen,
  });

  useEffect(() => {
    setPage(1);
  }, [search, anioFilter, fechaDesde, fechaHasta, medioFilter, anuladoFilter]);

  // Deep-link desde inicio / libramiento: /pagos?nuevo=1 | /pagos?libramiento=
  useEffect(() => {
    const libId = searchParams.get('libramiento');
    const nuevo = searchParams.get('nuevo') === '1';
    if (!canWrite) return;

    if (libId) {
      const parsed = Number(libId);
      if (!Number.isNaN(parsed)) {
        setInitialLibramientoId(parsed);
        setModalOpen(true);
      }
      setSearchParams({}, { replace: true });
      return;
    }

    if (nuevo) {
      setInitialLibramientoId(null);
      setModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, canWrite, setSearchParams]);

  const handleSort = (column: string) => {
    if (sortBy === column) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setAnioFilter(currentYear);
    setFechaDesde('');
    setFechaHasta('');
    setMedioFilter('');
    setAnuladoFilter('');
    setPage(1);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportPagosCsv(filters);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;
  const rowOffset = (page - 1) * PAGE_SIZE;

  const columns: SpreadsheetColumn<Pago>[] = [
    {
      key: 'numero',
      header: 'Número',
      sortable: true,
      width: 'w-28',
      render: (pago) => (
        <span className="font-mono font-semibold text-primary-800">{pago.numero_completo}</span>
      ),
    },
    {
      key: 'fecha_pago',
      header: 'Fecha',
      sortable: true,
      width: 'w-24',
      render: (pago) => <span className="tabular-nums">{formatDate(pago.fecha_pago)}</span>,
    },
    {
      key: 'beneficiario',
      header: 'Beneficiario',
      sortable: true,
      render: (pago) => <span className="font-medium">{pago.beneficiario}</span>,
    },
    {
      key: 'monto',
      header: 'Monto',
      sortable: true,
      width: 'w-32',
      align: 'right',
      render: (pago) => (
        <span className="font-medium tabular-nums text-emerald-700">
          {formatCurrency(pago.monto)}
        </span>
      ),
    },
    {
      key: 'medio_pago',
      header: 'Medio',
      sortable: true,
      width: 'w-28',
      render: (pago) => (
        <span className="text-slate-600">{MEDIO_PAGO_LABELS[pago.medio_pago]}</span>
      ),
    },
    {
      key: 'libramiento',
      header: 'Libramiento',
      width: 'w-28',
      render: (pago) => (
        <span className="font-mono text-slate-600">{pago.libramiento_numero ?? '—'}</span>
      ),
    },
    {
      key: 'expediente',
      header: 'Expediente',
      width: 'w-28',
      render: (pago) => (
        <span className="font-mono text-slate-600">{pago.expediente_numero}</span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: 'w-24',
      render: (pago) => (
        <StatusBadge
          label={pago.anulado ? 'Anulado' : 'Vigente'}
          variant={pago.anulado ? 'danger' : 'success'}
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
              cards={[
                {
                  id: 'pagados',
                  label: 'Pagos registrados',
                  value: resumen.totalPagados,
                  valueClassName: 'text-slate-800',
                },
                {
                  id: 'monto-pagado',
                  label: 'Monto pagado',
                  value: resumen.montoPagado,
                  displayValue: formatCurrency(resumen.montoPagado),
                  valueClassName: 'text-emerald-700',
                },
                {
                  id: 'pendientes',
                  label: 'Pendientes',
                  value: resumen.pendientes,
                  valueClassName: 'text-amber-700',
                },
                {
                  id: 'monto-pendiente',
                  label: 'Monto pendiente',
                  value: resumen.montoPendiente,
                  displayValue: formatCurrency(resumen.montoPendiente),
                  valueClassName: 'text-amber-600',
                },
              ]}
            />
          ) : undefined
        }
      >
        <SpreadsheetShell
          fillHeight
          title="Pagos"
          actions={
            <SpreadsheetTitleActions
              onExport={handleExport}
              exporting={exporting}
              exportLabel="Exportar CSV"
              onNew={() => {
                setInitialLibramientoId(null);
                setModalOpen(true);
              }}
              newLabel="Registrar pago"
              canWrite={canWrite}
            />
          }
          filters={
            <div className="flex w-full flex-wrap items-center gap-2.5">
              <Filter size={16} className="shrink-0 text-slate-400" />
              <div className="relative min-w-[220px] flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar número, expediente, libramiento, comprobante o beneficiario..."
                  className={`${spreadsheet.filterInput} w-full pl-9`}
                />
              </div>
              <input
                type="number"
                value={anioFilter}
                onChange={(e) => setAnioFilter(e.target.value)}
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
              <select
                value={medioFilter}
                onChange={(e) => setMedioFilter(e.target.value)}
                className={spreadsheet.filterSelect}
                title="Medio de pago"
              >
                <option value="">Todos los medios</option>
                {medioOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                value={anuladoFilter}
                onChange={(e) => setAnuladoFilter(e.target.value)}
                className={spreadsheet.filterSelect}
                title="Estado"
              >
                <option value="">Todos los estados</option>
                <option value="false">Vigentes</option>
                <option value="true">Anulados</option>
              </select>
              <SpreadsheetReloadButton onReload={() => refetch()} loading={isFetching} />
              <button
                type="button"
                onClick={handleClearFilters}
                className={spreadsheet.toolbarBtn}
              >
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
                      <strong>{data.total}</strong> pago{data.total !== 1 ? 's' : ''}
                    </span>
                    <span className="text-slate-400">|</span>
                    <span>
                      Mostrando {data.data.length > 0 ? rowOffset + 1 : 0}–
                      {rowOffset + data.data.length}
                    </span>
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
            rowKey={(pago) => pago.id}
            loading={isLoading}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onRowClick={(pago) => navigate(`/pagos/${pago.id}`)}
            rowNumberOffset={rowOffset}
            emptyMessage="No se encontraron pagos con los filtros aplicados"
          />
        </SpreadsheetShell>
      </PageListLayout>

      <NuevoPagoModal
        open={modalOpen}
        initialLibramientoId={initialLibramientoId}
        onClose={() => {
          setModalOpen(false);
          setInitialLibramientoId(null);
        }}
        onCreated={(pago) => {
          queryClient.invalidateQueries({ queryKey: ['pagos'] });
          navigate(`/pagos/${pago.id}`);
        }}
      />
    </>
  );
}
