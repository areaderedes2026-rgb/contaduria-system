import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, RotateCcw } from 'lucide-react';
import {
  getLibramientosAnticipo,
  getLibramientosAnticipoResumen,
  exportLibramientosAnticipoCsv,
} from '@/services/libramientosAnticipo.service';
import { NuevoLibramientoAnticipoModal } from '@/components/libramientos/NuevoLibramientoAnticipoModal';
import { PageListLayout } from '@/components/layout/PageListLayout';
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
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatDate } from '@/utils/format';
import type { LibramientoAnticipo } from '@/types';

const PAGE_SIZE = 20;

export function LibramientosAnticipoPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const canWrite = useAuthStore((s) => s.hasPermission('libramientos:write'));

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 350);
  const [anioFilter, setAnioFilter] = useState(String(new Date().getFullYear()));
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [modalOpen, setModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const filters = {
    search: search || undefined,
    anio: anioFilter ? Number(anioFilter) : undefined,
    fechaDesde: fechaDesde || undefined,
    fechaHasta: fechaHasta || undefined,
  };

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['libramientos-anticipo', page, filters, sortBy, sortOrder],
    queryFn: () =>
      getLibramientosAnticipo({ page, limit: PAGE_SIZE, ...filters, sortBy, sortOrder }),
  });

  const { data: resumen } = useQuery({
    queryKey: ['libramientos-anticipo-resumen'],
    queryFn: getLibramientosAnticipoResumen,
  });

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (searchParams.get('nuevo') === '1' && canWrite) {
      setModalOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('nuevo');
      setSearchParams(next, { replace: true });
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
    setAnioFilter(String(new Date().getFullYear()));
    setFechaDesde('');
    setFechaHasta('');
    setPage(1);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportLibramientosAnticipoCsv(filters);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;
  const rowOffset = (page - 1) * PAGE_SIZE;

  const columns: SpreadsheetColumn<LibramientoAnticipo>[] = [
    {
      key: 'numero',
      header: 'Número',
      sortable: true,
      width: 'w-32',
      render: (lib) => (
        <span className="font-mono font-semibold text-primary-800">{lib.numero_completo}</span>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      sortable: true,
      width: 'w-24',
      render: (lib) => <span className="tabular-nums">{formatDate(lib.fecha)}</span>,
    },
    {
      key: 'beneficiario',
      header: 'Beneficiario',
      sortable: true,
      render: (lib) => <span className="font-medium">{lib.beneficiario}</span>,
    },
    {
      key: 'importe',
      header: 'Importe',
      sortable: true,
      width: 'w-28',
      align: 'right',
      render: (lib) => (
        <span className="font-medium tabular-nums">{formatCurrency(lib.importe)}</span>
      ),
    },
    {
      key: 'neto',
      header: 'Neto',
      sortable: true,
      width: 'w-28',
      align: 'right',
      render: (lib) => (
        <span className="font-medium tabular-nums text-emerald-700">{formatCurrency(lib.neto)}</span>
      ),
    },
    {
      key: 'anticipo',
      header: 'Anticipo',
      width: 'w-28',
      render: (lib) => <span className="font-mono text-slate-600">{lib.anticipo_numero}</span>,
    },
    {
      key: 'expediente',
      header: 'Expediente',
      width: 'w-28',
      render: (lib) => <span className="font-mono text-slate-600">{lib.expediente_numero}</span>,
    },
    {
      key: 'estado',
      header: 'Estado',
      width: 'w-24',
      render: (lib) =>
        lib.anulado ? (
          <StatusBadge label="Anulado" variant="danger" />
        ) : (
          <StatusBadge label="Activo" variant="success" />
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
                { id: 'activos', label: 'Activos', value: resumen.total, valueClassName: 'text-slate-800' },
                {
                  id: 'neto',
                  label: 'Neto total',
                  value: resumen.netoTotal,
                  displayValue: formatCurrency(resumen.netoTotal),
                  valueClassName: 'text-primary-700',
                },
              ]}
            />
          ) : undefined
        }
      >
        <SpreadsheetShell
          fillHeight
          title="Libramientos de anticipo"
          actions={
            <SpreadsheetTitleActions
              onExport={handleExport}
              exporting={exporting}
              onNew={() => setModalOpen(true)}
              newLabel="Nuevo libramiento"
              canWrite={canWrite}
            />
          }
          filters={
            <div className="flex w-full flex-wrap items-center gap-2.5">
              <Filter size={16} className="shrink-0 text-slate-400" />
              <div className="relative min-w-[220px] flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar por número, expediente, anticipo o beneficiario..."
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
            rowKey={(lib) => lib.id}
            loading={isLoading}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onRowClick={(lib) => navigate(`/libramientos-anticipo/${lib.id}`)}
            rowNumberOffset={rowOffset}
            emptyMessage="No hay libramientos de anticipo con los filtros aplicados"
          />
        </SpreadsheetShell>
      </PageListLayout>

      <NuevoLibramientoAnticipoModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
