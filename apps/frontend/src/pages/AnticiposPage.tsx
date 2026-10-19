import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, RotateCcw } from 'lucide-react';
import {
  getAnticipos,
  getAnticiposResumen,
  exportAnticiposCsv,
} from '@/services/anticipos.service';
import { NuevoAnticipoModal } from '@/components/anticipos/NuevoAnticipoModal';
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
import type { Anticipo } from '@/types';

const PAGE_SIZE = 20;

export function AnticiposPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const canWrite = useAuthStore((s) => s.hasPermission('afectaciones:write'));

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
    queryKey: ['anticipos', page, filters, sortBy, sortOrder],
    queryFn: () => getAnticipos({ page, limit: PAGE_SIZE, ...filters, sortBy, sortOrder }),
  });

  const { data: resumen } = useQuery({
    queryKey: ['anticipos-resumen'],
    queryFn: getAnticiposResumen,
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
      await exportAnticiposCsv(filters);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;
  const rowOffset = (page - 1) * PAGE_SIZE;

  const columns: SpreadsheetColumn<Anticipo>[] = [
    {
      key: 'numero',
      header: 'Número',
      sortable: true,
      width: 'w-32',
      render: (af) => (
        <span className="font-mono font-semibold text-primary-800">{af.numero_completo}</span>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      sortable: true,
      width: 'w-24',
      render: (af) => <span className="tabular-nums">{formatDate(af.fecha)}</span>,
    },
    {
      key: 'destinatario',
      header: 'Destinatario',
      sortable: true,
      render: (af) => <span className="font-medium">{af.destinatario}</span>,
    },
    {
      key: 'importe',
      header: 'Importe',
      sortable: true,
      width: 'w-32',
      align: 'right',
      render: (af) => (
        <span className="font-medium text-emerald-700 tabular-nums">
          {formatCurrency(af.importe)}
        </span>
      ),
    },
    {
      key: 'cuenta',
      header: 'Cuenta',
      width: 'w-36',
      render: (af) => (
        <span className="font-mono text-slate-600">{af.cuenta_codigo ?? '—'}</span>
      ),
    },
    {
      key: 'comprobante',
      header: 'Comprobante',
      width: 'w-32',
      render: (af) =>
        af.numero_comprobante ? (
          <span className="font-mono text-slate-600">{af.numero_comprobante}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'expediente',
      header: 'Expediente',
      width: 'w-28',
      render: (af) => <span className="font-mono text-slate-600">{af.expediente_numero}</span>,
    },
    {
      key: 'estado',
      header: 'Estado',
      width: 'w-24',
      render: (af) =>
        af.anulada ? (
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
                  id: 'importe',
                  label: 'Importe anticipado',
                  value: resumen.importeTotal,
                  displayValue: formatCurrency(resumen.importeTotal),
                  valueClassName: 'text-primary-700',
                },
              ]}
            />
          ) : undefined
        }
      >
        <SpreadsheetShell
          fillHeight
          title="Anticipos"
          actions={
            <SpreadsheetTitleActions
              onExport={handleExport}
              exporting={exporting}
              onNew={() => setModalOpen(true)}
              newLabel="Nuevo anticipo"
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
                  placeholder="Buscar por número, expediente o destinatario..."
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
                      <strong>{data.total}</strong> anticipo{data.total !== 1 ? 's' : ''}
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
            rowKey={(af) => af.id}
            loading={isLoading}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onRowClick={(af) => navigate(`/anticipos/${af.id}`)}
            rowNumberOffset={rowOffset}
            emptyMessage="No hay anticipos con los filtros aplicados"
          />
        </SpreadsheetShell>
      </PageListLayout>

      <NuevoAnticipoModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
