import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, RotateCcw } from 'lucide-react';
import {
  getLibramientosConsolidados,
  getLibramientosResumen,
  exportLibramientosCsv,
} from '@/services/libramientos.service';
import {
  NuevoLibramientoUnificadoModal,
  type LibramientoOrigenTab,
} from '@/components/libramientos/NuevoLibramientoUnificadoModal';
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
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatDate } from '@/utils/format';
import type { CircuitoExpediente, LibramientoConsolidado } from '@/types';

const PAGE_SIZE = 20;

export function LibramientosPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const canWrite = useAuthStore((s) => s.hasPermission('libramientos:write'));

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 350);
  const [anioFilter, setAnioFilter] = useState(String(new Date().getFullYear()));
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [circuitoFilter, setCircuitoFilter] = useState<CircuitoExpediente | ''>('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<LibramientoOrigenTab>('afectacion');
  const [exporting, setExporting] = useState(false);
  const circuito = circuitoFilter || undefined;

  const filters = {
    search: search || undefined,
    anio: anioFilter ? Number(anioFilter) : undefined,
    fechaDesde: fechaDesde || undefined,
    fechaHasta: fechaHasta || undefined,
    circuito,
  };

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['libramientos', page, filters, sortBy, sortOrder],
    queryFn: () =>
      getLibramientosConsolidados({ page, limit: PAGE_SIZE, ...filters, sortBy, sortOrder }),
  });

  const { data: resumen } = useQuery({
    queryKey: ['libramientos-resumen', circuito],
    queryFn: () => getLibramientosResumen(circuito),
  });

  useEffect(() => {
    setPage(1);
  }, [search]);

  // Deep-link: /libramientos?nuevo=1&circuito=CARGO_A_RENDIR
  useEffect(() => {
    const circuitoParam = searchParams.get('circuito');
    if (circuitoParam === 'NORMAL' || circuitoParam === 'CARGO_A_RENDIR') {
      setCircuitoFilter(circuitoParam);
    }
    if (searchParams.get('nuevo') === '1' && canWrite) {
      setModalTab(circuitoParam === 'CARGO_A_RENDIR' ? 'anticipo' : 'afectacion');
      setModalOpen(true);
    }
    if (searchParams.get('nuevo') === '1' || circuitoParam) {
      const next = new URLSearchParams(searchParams);
      next.delete('nuevo');
      next.delete('circuito');
      setSearchParams(next, { replace: true });
    }
    // Solo al montar / cambiar searchParams de deep-link
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, canWrite, setSearchParams]);

  const handleClearFilters = () => {
    setSearchInput('');
    setAnioFilter(String(new Date().getFullYear()));
    setFechaDesde('');
    setFechaHasta('');
    setCircuitoFilter('');
    setPage(1);
    setSortBy('created_at');
    setSortOrder('desc');
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportLibramientosCsv(filters);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;
  const rowOffset = (page - 1) * PAGE_SIZE;

  const columns: SpreadsheetColumn<LibramientoConsolidado>[] = [
    {
      key: 'numero',
      header: 'Número',
      sortable: true,
      width: 'w-28',
      render: (lib) => (
        <span className="font-mono font-semibold text-primary-800">{lib.numero_completo}</span>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      sortable: true,
      width: 'w-28',
      render: (lib) => <span className="tabular-nums text-slate-600">{formatDate(lib.fecha)}</span>,
    },
    {
      key: 'expediente',
      header: 'Expediente',
      width: 'w-28',
      render: (lib) => (
        <span className="font-mono text-sm text-slate-700">{lib.expediente_numero}</span>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      width: 'w-32',
      render: (lib) =>
        lib.circuito === 'CARGO_A_RENDIR' || lib.origen === 'LIBRAMIENTO_ANTICIPO' ? (
          <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
            Cargo a rendir
          </span>
        ) : (
          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
            Normal
          </span>
        ),
    },
    {
      key: 'beneficiario',
      header: 'Beneficiario',
      sortable: true,
      render: (lib) => <span className="font-medium text-slate-800">{lib.beneficiario}</span>,
    },
    {
      key: 'importe',
      header: 'Importe',
      sortable: true,
      width: 'w-32',
      align: 'right',
      render: (lib) => (
        <span className="tabular-nums text-slate-700">{formatCurrency(lib.importe)}</span>
      ),
    },
    {
      key: 'neto',
      header: 'Neto',
      sortable: true,
      width: 'w-32',
      align: 'right',
      render: (lib) => (
        <span className="font-medium tabular-nums text-emerald-700">{formatCurrency(lib.neto)}</span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: 'w-28',
      render: (lib) =>
        lib.anulado ? (
          <StatusBadge label="Anulado" variant="danger" />
        ) : lib.pagado ? (
          <StatusBadge label="Pagado" variant="success" />
        ) : (
          <StatusBadge label="Pendiente" variant="warning" />
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
                  id: 'activos',
                  label: 'Activos',
                  value: resumen.total,
                  valueClassName: 'text-slate-800',
                },
                {
                  id: 'importe',
                  label: 'Importe total',
                  value: resumen.importeTotal,
                  displayValue: formatCurrency(resumen.importeTotal),
                  valueClassName: 'text-primary-700',
                },
                {
                  id: 'neto',
                  label: 'Neto a pagar',
                  value: resumen.netoTotal,
                  displayValue: formatCurrency(resumen.netoTotal),
                  valueClassName: 'text-emerald-700',
                },
              ]}
            />
          ) : undefined
        }
      >
        <SpreadsheetShell
          fillHeight
          title="Libramientos"
          actions={
            <SpreadsheetTitleActions
              onExport={handleExport}
              exporting={exporting}
              onNew={() => {
                setModalTab('afectacion');
                setModalOpen(true);
              }}
              newLabel="Nuevo libramiento"
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
                  placeholder="Buscar por número, expediente, beneficiario o decreto..."
                  className={`${spreadsheet.filterInput} w-full pl-9`}
                />
              </div>
              <input
                type="number"
                value={anioFilter}
                onChange={(e) => {
                  setAnioFilter(e.target.value);
                  setPage(1);
                }}
                placeholder="Año"
                className={`${spreadsheet.filterInput} w-24`}
                title="Año"
              />
              <select
                value={circuitoFilter}
                onChange={(e) => {
                  setCircuitoFilter(e.target.value as CircuitoExpediente | '');
                  setPage(1);
                }}
                className={spreadsheet.filterSelect}
                title="Tipo"
              >
                <option value="">Todos los tipos</option>
                <option value="NORMAL">Normal</option>
                <option value="CARGO_A_RENDIR">Cargo a rendir</option>
              </select>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => {
                  setFechaDesde(e.target.value);
                  setPage(1);
                }}
                className={spreadsheet.filterInput}
                title="Desde"
              />
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => {
                  setFechaHasta(e.target.value);
                  setPage(1);
                }}
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
                      <strong>{data.total}</strong> libramiento{data.total !== 1 ? 's' : ''}
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
            rowKey={(lib) => `${lib.origen}-${lib.id}`}
            loading={isLoading}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onRowClick={(lib) =>
              navigate(
                lib.origen === 'LIBRAMIENTO_ANTICIPO'
                  ? `/libramientos-anticipo/${lib.id}`
                  : `/libramientos/${lib.id}`
              )
            }
            rowNumberOffset={rowOffset}
            emptyMessage="No hay libramientos con los filtros aplicados"
          />
        </SpreadsheetShell>
      </PageListLayout>

      <NuevoLibramientoUnificadoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialTab={modalTab}
      />
    </>
  );
}
