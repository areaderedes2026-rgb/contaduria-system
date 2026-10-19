import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Trash2,
  ListTree,
  Table2,
  RotateCcw,
  Filter,
  ArrowLeft,
} from 'lucide-react';
import {
  getCuentas,
  getCuentasArbol,
  getCuentasResumen,
  deleteCuenta,
  exportCuentasCsv,
} from '@/services/cuentas.service';
import { CuentaTreeView } from '@/components/cuentas/CuentaTreeView';
import { CuentaFormModal } from '@/components/cuentas/CuentaFormModal';
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
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, TIPO_CUENTA_LABELS, ESTADO_CUENTA_LABELS } from '@/utils/format';
import {
  clearPlanCuentasListQuery,
  PLAN_CUENTAS_LIST_QUERY_KEY,
  savePlanCuentasListQuery,
} from '@/utils/planCuentasListState';
import { getNavigationReturn } from '@/utils/navigationReturn';
import type { Cuenta, CuentaTreeNode } from '@/types';

type ViewMode = 'tabla' | 'arbol';

const PAGE_SIZE = 20;

const TIPO_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'RECURSO', label: 'Recurso' },
  { value: 'GASTO', label: 'Gasto' },
  { value: 'PATRIMONIAL', label: 'Patrimonial' },
];

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'ACTIVA', label: 'Activa' },
  { value: 'INACTIVA', label: 'Inactiva' },
];

function TipoBadge({ tipo }: { tipo: string }) {
  const variants: Record<string, 'success' | 'warning' | 'info'> = {
    RECURSO: 'success',
    GASTO: 'warning',
    PATRIMONIAL: 'info',
  };
  return (
    <StatusBadge
      label={TIPO_CUENTA_LABELS[tipo] ?? tipo}
      variant={variants[tipo] ?? 'neutral'}
    />
  );
}

function parseViewMode(value: string | null): ViewMode {
  return value === 'arbol' ? 'arbol' : 'tabla';
}

function parseSortOrder(value: string | null): 'asc' | 'desc' {
  return value === 'desc' ? 'desc' : 'asc';
}

function getListParamsFrom(source: URLSearchParams) {
  const pageRaw = Number(source.get('page'));
  return {
    q: source.get('q') ?? '',
    exact: source.get('exact') === '1',
    tipo: source.get('tipo') ?? '',
    estado: source.get('estado') ?? '',
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
    sortBy: source.get('sortBy') ?? 'codigo',
    sortOrder: parseSortOrder(source.get('sortOrder')),
    view: parseViewMode(source.get('view')),
  };
}

function resolveInitialListParams(searchParams: URLSearchParams) {
  if ([...searchParams.keys()].length > 0) {
    return getListParamsFrom(searchParams);
  }
  try {
    const saved = sessionStorage.getItem(PLAN_CUENTAS_LIST_QUERY_KEY);
    if (saved) return getListParamsFrom(new URLSearchParams(saved));
  } catch {
    /* ignore */
  }
  return getListParamsFrom(new URLSearchParams());
}

export function PlanCuentasPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission('cuentas:write'));
  const skipPageReset = useRef(true);
  const initial = useRef(resolveInitialListParams(searchParams)).current;
  const returnTo = getNavigationReturn(location.state);

  const [viewMode, setViewMode] = useState<ViewMode>(initial.view);
  const [page, setPage] = useState(initial.page);
  const [searchInput, setSearchInput] = useState(initial.q);
  const [exactCodigo, setExactCodigo] = useState(initial.exact);
  const search = useDebouncedValue(searchInput.trim(), 350);
  const [tipoFilter, setTipoFilter] = useState(initial.tipo);
  const [estadoFilter, setEstadoFilter] = useState(initial.estado);
  const [sortBy, setSortBy] = useState(initial.sortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initial.sortOrder);

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Cuenta | CuentaTreeNode | null>(null);
  const [exporting, setExporting] = useState(false);

  const filters = {
    search: exactCodigo ? undefined : search || undefined,
    codigoExacto: exactCodigo && search ? search : undefined,
    tipo: tipoFilter || undefined,
    estado: estadoFilter || undefined,
  };

  // Persistí filtros en la URL y en sessionStorage para restaurar al volver del detalle
  useEffect(() => {
    const next = new URLSearchParams();
    if (searchInput.trim()) next.set('q', searchInput.trim());
    if (exactCodigo && searchInput.trim()) next.set('exact', '1');
    if (tipoFilter) next.set('tipo', tipoFilter);
    if (estadoFilter) next.set('estado', estadoFilter);
    if (page > 1) next.set('page', String(page));
    if (sortBy !== 'codigo') next.set('sortBy', sortBy);
    if (sortOrder !== 'asc') next.set('sortOrder', sortOrder);
    if (viewMode !== 'tabla') next.set('view', viewMode);

    const serialized = next.toString();
    // No sobrescribir el listado guardado cuando venimos a ver una cuenta exacta
    if (!exactCodigo) {
      savePlanCuentasListQuery(serialized);
    }

    if (serialized !== searchParams.toString()) {
      setSearchParams(next, { replace: true, state: location.state });
    }
  }, [
    searchInput,
    exactCodigo,
    tipoFilter,
    estadoFilter,
    page,
    sortBy,
    sortOrder,
    viewMode,
    setSearchParams,
    searchParams,
    location.state,
  ]);

  // Si llega una navegación externa con ?q=&exact=1, aplicar filtros
  useEffect(() => {
    const params = getListParamsFrom(searchParams);
    if (!params.exact || !params.q) return;
    if (searchInput === params.q && exactCodigo && viewMode === 'tabla') return;
    setSearchInput(params.q);
    setExactCodigo(true);
    setViewMode('tabla');
    setPage(1);
    setTipoFilter('');
    setEstadoFilter('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reaccionar a la URL de entrada
  }, [searchParams.toString()]);

  const { data, isLoading, isFetching: isFetchingTabla, refetch: refetchTabla } = useQuery({
    queryKey: ['cuentas', page, search, exactCodigo, tipoFilter, estadoFilter, sortBy, sortOrder],
    queryFn: () =>
      getCuentas({ page, limit: PAGE_SIZE, ...filters, sortBy, sortOrder }),
    enabled: viewMode === 'tabla',
  });

  const { data: arbol, isLoading: arbolLoading, isFetching: isFetchingArbol, refetch: refetchArbol } = useQuery({
    queryKey: ['cuentas-arbol', tipoFilter, estadoFilter],
    queryFn: () =>
      getCuentasArbol({
        tipo: tipoFilter || undefined,
        estado: estadoFilter || undefined,
      }),
    enabled: viewMode === 'arbol',
  });

  useEffect(() => {
    if (skipPageReset.current) {
      skipPageReset.current = false;
      return;
    }
    setPage(1);
  }, [search, exactCodigo]);

  const isFetching = viewMode === 'tabla' ? isFetchingTabla : isFetchingArbol;
  const handleReload = () => {
    if (viewMode === 'tabla') refetchTabla();
    else refetchArbol();
  };

  const { data: resumen } = useQuery({
    queryKey: ['cuentas-resumen'],
    queryFn: getCuentasResumen,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCuenta(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas-arbol'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas-padres'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setConfirmDelete(null);
    },
  });

  const openCreate = () => {
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const openCuenta = (cuenta: Cuenta | CuentaTreeNode) => {
    navigate(`/plan-cuentas/${cuenta.id}`, {
      state: returnTo ? { from: returnTo } : undefined,
    });
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

  const handleClearFilters = () => {
    setSearchInput('');
    setExactCodigo(false);
    setTipoFilter('');
    setEstadoFilter('');
    setPage(1);
    setSortBy('codigo');
    setSortOrder('asc');
    clearPlanCuentasListQuery();
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportCuentasCsv({
        search: exactCodigo ? undefined : filters.search,
        tipo: filters.tipo,
        estado: filters.estado,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;
  const rowOffset = (page - 1) * PAGE_SIZE;

  const columns: SpreadsheetColumn<Cuenta>[] = [
    {
      key: 'codigo',
      header: 'Código',
      sortable: true,
      width: 'w-36',
      render: (cuenta) => (
        <span className="font-mono font-semibold text-primary-800">{cuenta.codigo}</span>
      ),
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      sortable: true,
      render: (cuenta) => <span className="font-medium">{cuenta.descripcion}</span>,
    },
    {
      key: 'tipo',
      header: 'Tipo',
      sortable: true,
      width: 'w-28',
      render: (cuenta) => <TipoBadge tipo={cuenta.tipo} />,
    },
    {
      key: 'saldo_inicial',
      header: 'Saldo inicial',
      sortable: true,
      width: 'w-32',
      align: 'right',
      render: (cuenta) => (
        <span className="tabular-nums text-slate-600">{formatCurrency(cuenta.saldo_inicial)}</span>
      ),
    },
    {
      key: 'saldo_afectado',
      header: 'Afectado',
      sortable: true,
      width: 'w-32',
      align: 'right',
      render: (cuenta) => (
        <span className="tabular-nums text-amber-600">{formatCurrency(cuenta.saldo_afectado)}</span>
      ),
    },
    {
      key: 'saldo_disponible',
      header: 'Disponible',
      width: 'w-32',
      align: 'right',
      render: (cuenta) => (
        <span className="font-medium tabular-nums text-emerald-700">{formatCurrency(cuenta.saldo_disponible)}</span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      width: 'w-24',
      render: (cuenta) => (
        <StatusBadge
          label={ESTADO_CUENTA_LABELS[cuenta.estado]}
          variant={cuenta.estado === 'ACTIVA' ? 'success' : 'danger'}
        />
      ),
    },
    ...(canWrite
      ? [{
          key: 'acciones',
          header: 'Acciones',
          width: 'w-16',
          align: 'right' as const,
          render: (cuenta: Cuenta) => (
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setConfirmDelete(cuenta)}
                className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                title="Eliminar"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ),
        }]
      : []),
  ];

  return (
    <>
    {returnTo && (
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary-200 bg-primary-50 px-3 py-2">
        <Link
          to={returnTo.to}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-800 hover:underline"
        >
          <ArrowLeft size={16} />
          {returnTo.label}
        </Link>
        {exactCodigo && searchInput.trim() && (
          <span className="text-xs text-primary-700">
            Mostrando solo la cuenta <span className="font-mono font-semibold">{searchInput.trim()}</span>
          </span>
        )}
      </div>
    )}
    {!returnTo && exactCodigo && searchInput.trim() && (
      <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Mostrando solo la cuenta{' '}
        <span className="font-mono font-semibold text-slate-800">{searchInput.trim()}</span>
        .{' '}
        <button
          type="button"
          onClick={handleClearFilters}
          className="font-medium text-primary-700 hover:underline"
        >
          Ver todas
        </button>
      </div>
    )}
    <PageListLayout
      collapsibleStats
      stats={
        resumen ? (
          <SpreadsheetStatCards
            cards={[
              {
                id: 'activas',
                label: 'Cuentas activas',
                value: resumen.totalActivas,
                valueClassName: 'text-slate-800',
              },
              {
                id: 'inicial',
                label: 'Saldo inicial',
                value: resumen.totalInicial,
                displayValue: formatCurrency(resumen.totalInicial),
                valueClassName: 'text-primary-700',
              },
              {
                id: 'afectado',
                label: 'Afectado',
                value: resumen.totalAfectado,
                displayValue: formatCurrency(resumen.totalAfectado),
                valueClassName: 'text-amber-600',
              },
              {
                id: 'disponible',
                label: 'Disponible',
                value: resumen.totalDisponible,
                displayValue: formatCurrency(resumen.totalDisponible),
                valueClassName: 'text-emerald-600',
              },
            ]}
          />
        ) : undefined
      }
    >
      <SpreadsheetShell
        fillHeight
        title="Plan de Cuentas"
        actions={
          <SpreadsheetTitleActions
            onExport={handleExport}
            exporting={exporting}
            exportLabel="Exportar CSV"
            onNew={openCreate}
            newLabel="Nueva cuenta"
            canWrite={canWrite}
            extra={
              <div className="mr-1 flex overflow-hidden rounded-md border border-primary-700/60">
                <button
                  type="button"
                  onClick={() => setViewMode('tabla')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewMode === 'tabla'
                      ? 'bg-white text-primary-900'
                      : 'text-primary-100 hover:bg-primary-800 hover:text-white'
                  }`}
                  title="Vista tabla"
                >
                  <Table2 size={15} />
                  Tabla
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('arbol')}
                  className={`inline-flex items-center gap-1.5 border-l border-primary-700/60 px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewMode === 'arbol'
                      ? 'bg-white text-primary-900'
                      : 'text-primary-100 hover:bg-primary-800 hover:text-white'
                  }`}
                  title="Vista árbol"
                >
                  <ListTree size={15} />
                  Árbol
                </button>
              </div>
            }
          />
        }
        filters={
          <div className="flex w-full flex-wrap items-center gap-2.5">
            <Filter size={16} className="shrink-0 text-slate-400" />
            <div className="relative min-w-[200px] flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  if (exactCodigo) setExactCodigo(false);
                }}
                placeholder="Buscar por código o descripción..."
                className={`${spreadsheet.filterInput} w-full pl-9`}
                disabled={viewMode === 'arbol'}
              />
            </div>
            <select
              value={tipoFilter}
              onChange={(e) => { setTipoFilter(e.target.value); setPage(1); }}
              className={spreadsheet.filterSelect}
              title="Tipo"
            >
              {TIPO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
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
            <SpreadsheetReloadButton onReload={handleReload} loading={isFetching} />
            <button type="button" onClick={handleClearFilters} className={spreadsheet.toolbarBtn}>
              <RotateCcw size={15} />
              Limpiar
            </button>
          </div>
        }
        footer={
          viewMode === 'tabla' ? (
            <SpreadsheetStatusBar
              left={
                data && (
                  <>
                    <span>
                      <strong>{data.total}</strong> cuenta{data.total !== 1 ? 's' : ''}
                    </span>
                    <span className="text-slate-400">|</span>
                    <span>Mostrando {data.data.length > 0 ? rowOffset + 1 : 0}–{rowOffset + data.data.length}</span>
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
          ) : (
            <SpreadsheetStatusBar
              left={
                <span>
                  <strong>{arbol?.length ?? 0}</strong> cuenta{arbol?.length !== 1 ? 's' : ''} raíz en el árbol
                </span>
              }
            />
          )
        }
      >
        {viewMode === 'tabla' ? (
          <SpreadsheetGrid
            columns={columns}
            data={data?.data ?? []}
            rowKey={(cuenta) => cuenta.id}
            loading={isLoading}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onRowClick={(cuenta) => openCuenta(cuenta)}
            rowNumberOffset={rowOffset}
            emptyMessage="No se encontraron cuentas con los filtros aplicados"
          />
        ) : arbolLoading ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">Cargando árbol...</div>
        ) : (
          <CuentaTreeView
            nodes={arbol ?? []}
            canWrite={canWrite}
            onOpen={openCuenta}
            onDelete={setConfirmDelete}
          />
        )}
      </SpreadsheetShell>
    </PageListLayout>

      <CuentaFormModal open={modalOpen} onClose={closeModal} />

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Confirmar eliminación" size="sm">
        <p className="mb-6 text-sm text-slate-600">
          ¿Está seguro que desea eliminar la cuenta{' '}
          <strong className="font-mono">{confirmDelete?.codigo}</strong> — {confirmDelete?.descripcion}?
          Solo se pueden eliminar cuentas sin subcuentas ni saldo afectado.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
          >
            Eliminar
          </Button>
        </div>
      </Modal>
    </>
  );
}
