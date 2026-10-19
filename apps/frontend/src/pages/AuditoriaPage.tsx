import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Search,
  Eye,
  Filter,
  User,
  ExternalLink,
} from 'lucide-react';
import {
  getAuditoria,
  getAuditoriaResumen,
  getAuditoriaFiltros,
  exportAuditoriaCsv,
  ACCION_LABELS,
  ENTIDAD_LABELS,
  ACCION_COLORS,
  getEntidadPath,
} from '@/services/auditoria.service';
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
import { Modal } from '@/components/ui/Modal';
import type { AuditoriaRegistro } from '@/types';

const PAGE_SIZE = 20;

const ACCION_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  CREAR: 'success',
  ACTUALIZAR: 'info',
  ELIMINAR: 'danger',
  ANULAR: 'warning',
  LOGIN: 'neutral',
  LOGOUT: 'neutral',
  EXPORTAR: 'info',
  CONSULTAR: 'neutral',
};

function AccionBadge({ accion }: { accion: string }) {
  const color = ACCION_COLORS[accion];
  if (color) {
    return (
      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
        {ACCION_LABELS[accion] ?? accion}
      </span>
    );
  }
  return (
    <StatusBadge
      label={ACCION_LABELS[accion] ?? accion}
      variant={ACCION_VARIANT[accion] ?? 'neutral'}
    />
  );
}

function DetalleModal({
  registro,
  onClose,
}: {
  registro: AuditoriaRegistro | null;
  onClose: () => void;
}) {
  if (!registro) return null;

  const entidadPath = getEntidadPath(registro.entidad, registro.entidad_id);

  return (
    <Modal open={!!registro} onClose={onClose} title={`Registro #${registro.id}`} size="lg">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Fecha y hora</dt>
          <dd className="mt-1">{new Date(registro.created_at).toLocaleString('es-AR')}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Usuario</dt>
          <dd className="mt-1">
            {registro.usuario_nombre ?? 'Sistema'}
            {registro.usuario_username && (
              <span className="ml-1 text-slate-500">({registro.usuario_username})</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Acción</dt>
          <dd className="mt-1"><AccionBadge accion={registro.accion} /></dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Entidad</dt>
          <dd className="mt-1">
            {ENTIDAD_LABELS[registro.entidad] ?? registro.entidad}
            {registro.entidad_id && ` #${registro.entidad_id}`}
            {entidadPath && (
              <Link to={entidadPath} className="ml-2 inline-flex items-center gap-1 text-sm text-primary-600 hover:underline">
                Ver <ExternalLink size={12} />
              </Link>
            )}
          </dd>
        </div>
        {registro.ip && (
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Dirección IP</dt>
            <dd className="mt-1 font-mono text-sm">{registro.ip}</dd>
          </div>
        )}
      </dl>

      {registro.cambios && Object.keys(registro.cambios).length > 0 && (
        <div className="mt-6">
          <h4 className="mb-2 text-sm font-medium text-slate-700">Detalle de cambios</h4>
          <div className="rounded-lg border border-border bg-slate-50 p-4">
            <dl className="space-y-2">
              {Object.entries(registro.cambios).map(([key, value]) => (
                <div key={key} className="flex flex-wrap gap-2 text-sm">
                  <dt className="font-medium text-slate-600">{key}:</dt>
                  <dd className="text-slate-800">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button variant="secondary" onClick={onClose}>Cerrar</Button>
      </div>
    </Modal>
  );
}

export function AuditoriaPage() {
  const [page, setPage] = useState(1);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [accion, setAccion] = useState('');
  const [entidad, setEntidad] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 350);
  const [exporting, setExporting] = useState(false);
  const [detalle, setDetalle] = useState<AuditoriaRegistro | null>(null);

  const filters = {
    fechaDesde: fechaDesde || undefined,
    fechaHasta: fechaHasta || undefined,
    usuarioId: usuarioId ? Number(usuarioId) : undefined,
    accion: accion || undefined,
    entidad: entidad || undefined,
    search: search || undefined,
  };

  const { data: resumen } = useQuery({
    queryKey: ['auditoria-resumen'],
    queryFn: getAuditoriaResumen,
  });

  const { data: filtros } = useQuery({
    queryKey: ['auditoria-filtros'],
    queryFn: getAuditoriaFiltros,
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['auditoria', page, filters],
    queryFn: () => getAuditoria({ page, limit: PAGE_SIZE, ...filters }),
  });

  useEffect(() => {
    setPage(1);
  }, [search]);

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportAuditoriaCsv(filters);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;
  const rowOffset = (page - 1) * PAGE_SIZE;

  const columns: SpreadsheetColumn<AuditoriaRegistro>[] = [
    {
      key: 'created_at',
      header: 'Fecha',
      width: 'w-44',
      render: (reg) => (
        <span className="whitespace-nowrap tabular-nums text-slate-600">
          {new Date(reg.created_at).toLocaleString('es-AR')}
        </span>
      ),
    },
    {
      key: 'usuario',
      header: 'Usuario',
      render: (reg) => (
        <div className="flex items-center gap-1.5">
          <User size={14} className="text-slate-400" />
          <span>{reg.usuario_username ?? 'Sistema'}</span>
        </div>
      ),
    },
    {
      key: 'accion',
      header: 'Acción',
      width: 'w-32',
      render: (reg) => <AccionBadge accion={reg.accion} />,
    },
    {
      key: 'entidad',
      header: 'Módulo',
      render: (reg) => ENTIDAD_LABELS[reg.entidad] ?? reg.entidad,
    },
    {
      key: 'entidad_id',
      header: 'ID',
      width: 'w-20',
      render: (reg) => (
        <span className="font-mono text-slate-600">{reg.entidad_id ?? '—'}</span>
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      width: 'w-28',
      render: (reg) => (
        <span className="font-mono text-xs text-slate-500">{reg.ip ?? '—'}</span>
      ),
    },
    {
      key: 'detalle',
      header: 'Detalle',
      width: 'w-24',
      align: 'right',
      render: (reg) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setDetalle(reg); }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
        >
          <Eye size={14} /> Ver
        </button>
      ),
    },
  ];

  return (
    <>
    <PageListLayout
      collapsibleStats
      stats={
        resumen ? (
          <div className="space-y-4">
            <SpreadsheetStatCards
              cards={[
                { id: 'total', label: 'Total registros', value: resumen.total, valueClassName: 'text-slate-800' },
                { id: 'hoy', label: 'Hoy', value: resumen.hoy, valueClassName: 'text-emerald-700' },
                { id: '7d', label: 'Últimos 7 días', value: resumen.ultimos7Dias, valueClassName: 'text-primary-700' },
                {
                  id: 'accion',
                  label: 'Acción frecuente',
                  value: resumen.porAccion[0]
                    ? (ACCION_LABELS[resumen.porAccion[0].accion] ?? resumen.porAccion[0].accion)
                    : '—',
                  valueClassName: 'text-base text-slate-800',
                },
              ]}
            />
            {resumen.porEntidad.length > 0 && (
              <SpreadsheetSection title="Actividad por módulo">
                <div className="flex flex-wrap gap-3 p-4">
                  {resumen.porEntidad.map((item) => (
                    <div key={item.entidad} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
                      <span className="font-medium">{ENTIDAD_LABELS[item.entidad] ?? item.entidad}</span>
                      <span className="ml-2 tabular-nums text-slate-500">{item.total}</span>
                    </div>
                  ))}
                </div>
              </SpreadsheetSection>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="min-h-0 flex-1">
      <SpreadsheetShell
        fillHeight
        title="Auditoría del sistema"
        actions={
          <SpreadsheetTitleActions
            onExport={handleExport}
            exporting={exporting}
            exportLabel="Exportar CSV"
            canWrite
          />
        }
        filters={
          <div className="flex w-full flex-col gap-2.5">
            <div className="flex w-full flex-wrap items-center gap-2.5">
              <Filter size={16} className="shrink-0 text-slate-400" />
              <div className="relative min-w-[220px] flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar por usuario, IP o contenido..."
                  className={`${spreadsheet.filterInput} w-full pl-9`}
                />
              </div>
              <SpreadsheetReloadButton onReload={() => refetch()} loading={isFetching} />
            </div>
            <div className="flex w-full flex-wrap items-center gap-2.5">
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
              <select
                value={usuarioId}
                onChange={(e) => { setUsuarioId(e.target.value); setPage(1); }}
                className={spreadsheet.filterSelect}
                title="Usuario"
              >
                <option value="">Todos los usuarios</option>
                {filtros?.usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.username})
                  </option>
                ))}
              </select>
              <select
                value={accion}
                onChange={(e) => { setAccion(e.target.value); setPage(1); }}
                className={spreadsheet.filterSelect}
                title="Acción"
              >
                <option value="">Todas las acciones</option>
                {filtros?.acciones.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
              <select
                value={entidad}
                onChange={(e) => { setEntidad(e.target.value); setPage(1); }}
                className={spreadsheet.filterSelect}
                title="Entidad"
              >
                <option value="">Todas las entidades</option>
                {filtros?.entidades.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </div>
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
                  <span>
                    Mostrando {data.data.length > 0 ? rowOffset + 1 : 0}–{rowOffset + data.data.length}
                  </span>
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
          rowKey={(reg) => reg.id}
          loading={isLoading}
          onRowClick={(reg) => setDetalle(reg)}
          rowNumberOffset={rowOffset}
          emptyMessage="No se encontraron registros"
        />
      </SpreadsheetShell>
        </div>
        <div className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            <strong>Nota de seguridad:</strong> Los registros de auditoría son de solo lectura y no pueden modificarse ni eliminarse.
            Solo los administradores tienen acceso a este módulo.
          </p>
        </div>
      </div>
    </PageListLayout>

      <DetalleModal registro={detalle} onClose={() => setDetalle(null)} />
    </>
  );
}
