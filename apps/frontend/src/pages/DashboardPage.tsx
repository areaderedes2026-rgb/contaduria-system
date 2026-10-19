import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  FolderOpen,
  Receipt,
  FileText,
  ArrowLeft,
  ExternalLink,
  FileSearch,
  Banknote,
} from 'lucide-react';
import { getDashboardStats } from '@/services/users.service';
import { getExpedientes } from '@/services/expedientes.service';
import { getAfectaciones } from '@/services/afectaciones.service';
import { getLibramientos } from '@/services/libramientos.service';
import {
  SpreadsheetShell,
  SpreadsheetStatCards,
  SpreadsheetGrid,
  SpreadsheetSection,
  StatusBadge,
  spreadsheet,
  type SpreadsheetColumn,
} from '@/components/spreadsheet';
import { EstadoExpedienteBadge } from '@/components/expedientes/EstadoExpedienteBadge';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatDate } from '@/utils/format';
import type { Afectacion, Expediente, Libramiento, EstadoExpediente } from '@/types';

type SearchKind = 'expediente' | 'afectacion' | 'libramiento';

const SEARCH_CARDS: {
  id: SearchKind;
  title: string;
  description: string;
  icon: typeof FolderOpen;
  permission: string;
  placeholder: string;
}[] = [
  {
    id: 'expediente',
    title: 'Expedientes',
    description: 'Buscar por número, proveedor o detalle',
    icon: FolderOpen,
    permission: 'expedientes:read',
    placeholder: 'Ej: 12/2026, nombre del proveedor…',
  },
  {
    id: 'afectacion',
    title: 'Afectaciones',
    description: 'Buscar por número, expediente o destinatario',
    icon: Receipt,
    permission: 'afectaciones:read',
    placeholder: 'Ej: 5-040826, expediente o destinatario…',
  },
  {
    id: 'libramiento',
    title: 'Libramientos',
    description: 'Buscar por número, expediente o beneficiario',
    icon: FileText,
    permission: 'libramientos:read',
    placeholder: 'Ej: 3-040826, decreto o beneficiario…',
  },
];

const STAT_ROUTES: Record<string, string> = {
  expedientes: '/expedientes',
  afectaciones: '/afectaciones',
  libramientos: '/libramientos',
  pagos: '/pagos',
  pagosPendientes: '/pagos',
};

export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const [searchKind, setSearchKind] = useState<SearchKind | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 350);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
  });

  const canSearchExpedientes = hasPermission('expedientes:read');
  const canSearchAfectaciones = hasPermission('afectaciones:read');
  const canSearchLibramientos = hasPermission('libramientos:read');

  const enabledSearch = searchKind != null && search.length >= 1;

  const { data: expResults, isFetching: loadingExp } = useQuery({
    queryKey: ['dashboard-search-exp', search],
    queryFn: () => getExpedientes({ search, page: 1, limit: 20, sortBy: 'created_at', sortOrder: 'desc' }),
    enabled: enabledSearch && searchKind === 'expediente' && canSearchExpedientes,
  });

  const { data: afResults, isFetching: loadingAf } = useQuery({
    queryKey: ['dashboard-search-af', search],
    queryFn: () =>
      getAfectaciones({ search, page: 1, limit: 20, sortBy: 'created_at', sortOrder: 'desc' }),
    enabled: enabledSearch && searchKind === 'afectacion' && canSearchAfectaciones,
  });

  const { data: libResults, isFetching: loadingLib } = useQuery({
    queryKey: ['dashboard-search-lib', search],
    queryFn: () =>
      getLibramientos({ search, page: 1, limit: 20, sortBy: 'created_at', sortOrder: 'desc' }),
    enabled: enabledSearch && searchKind === 'libramiento' && canSearchLibramientos,
  });

  useEffect(() => {
    if (searchKind) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [searchKind]);

  const selectKind = (kind: SearchKind) => {
    setSearchKind(kind);
    setSearchInput('');
  };

  const goBack = () => {
    setSearchKind(null);
    setSearchInput('');
  };

  const activeCard = SEARCH_CARDS.find((c) => c.id === searchKind);
  const availableCards = SEARCH_CARDS.filter((c) => hasPermission(c.permission));

  const isSearching =
    (searchKind === 'expediente' && loadingExp) ||
    (searchKind === 'afectacion' && loadingAf) ||
    (searchKind === 'libramiento' && loadingLib);

  const expColumns: SpreadsheetColumn<Expediente>[] = [
    {
      key: 'numero',
      header: 'Número',
      width: 'w-28',
      render: (e) => (
        <span className="font-mono font-semibold text-primary-800">{e.numero_completo}</span>
      ),
    },
    {
      key: 'fecha',
      header: 'Ingreso',
      width: 'w-28',
      render: (e) => <span className="tabular-nums">{formatDate(e.fechaIngreso)}</span>,
    },
    {
      key: 'proveedor',
      header: 'Proveedor',
      render: (e) => <span className="font-medium">{e.proveedor_nombre}</span>,
    },
    {
      key: 'detalle',
      header: 'Detalle',
      render: (e) => (
        <span className="line-clamp-1 text-slate-600" title={e.detalle}>
          {e.detalle}
        </span>
      ),
    },
    {
      key: 'importe',
      header: 'Importe',
      width: 'w-32',
      align: 'right',
      render: (e) => (
        <span className="font-medium tabular-nums">{formatCurrency(e.importe)}</span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: 'w-28',
      render: (e) => (
        <EstadoExpedienteBadge estado={e.estado as EstadoExpediente} anulado={e.anulado} />
      ),
    },
    {
      key: 'acciones',
      header: '',
      width: 'w-36',
      render: (e) => (
        <div className="flex flex-wrap gap-2" onClick={(ev) => ev.stopPropagation()}>
          <Link
            to={`/expedientes/${e.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
          >
            Detalle <ExternalLink size={11} />
          </Link>
          <Link
            to={`/consultas?tab=trazabilidad&expediente=${e.id}`}
            className="inline-flex items-center gap-1 text-xs text-slate-600 hover:underline"
          >
            <FileSearch size={11} /> Trazabilidad
          </Link>
        </div>
      ),
    },
  ];

  const afColumns: SpreadsheetColumn<Afectacion>[] = [
    {
      key: 'numero',
      header: 'Número',
      width: 'w-28',
      render: (a) => (
        <span className="font-mono font-semibold text-primary-800">{a.numero_completo}</span>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      width: 'w-28',
      render: (a) => <span className="tabular-nums">{formatDate(a.fecha)}</span>,
    },
    {
      key: 'expediente',
      header: 'Expediente',
      width: 'w-28',
      render: (a) => (
        <Link
          to={`/expedientes/${a.expediente_id}`}
          className="font-mono text-primary-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {a.expediente_numero ?? `#${a.expediente_id}`}
        </Link>
      ),
    },
    {
      key: 'destinatario',
      header: 'Destinatario',
      render: (a) => <span className="font-medium">{a.destinatario}</span>,
    },
    {
      key: 'importe',
      header: 'Importe',
      width: 'w-32',
      align: 'right',
      render: (a) => (
        <span className="font-medium tabular-nums text-amber-800">
          {formatCurrency(a.importe_total)}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: 'w-24',
      render: (a) => (
        <StatusBadge
          label={a.anulada ? 'Anulada' : 'Activa'}
          variant={a.anulada ? 'danger' : 'success'}
        />
      ),
    },
  ];

  const libColumns: SpreadsheetColumn<Libramiento>[] = [
    {
      key: 'numero',
      header: 'Número',
      width: 'w-28',
      render: (l) => (
        <span className="font-mono font-semibold text-primary-800">{l.numero_completo}</span>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      width: 'w-28',
      render: (l) => <span className="tabular-nums">{formatDate(l.fecha)}</span>,
    },
    {
      key: 'expediente',
      header: 'Expediente',
      width: 'w-28',
      render: (l) => (
        <Link
          to={`/expedientes/${l.expediente_id}`}
          className="font-mono text-primary-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {l.expediente_numero ?? `#${l.expediente_id}`}
        </Link>
      ),
    },
    {
      key: 'beneficiario',
      header: 'Beneficiario',
      render: (l) => <span className="font-medium">{l.beneficiario}</span>,
    },
    {
      key: 'neto',
      header: 'Neto',
      width: 'w-32',
      align: 'right',
      render: (l) => (
        <span className="font-medium tabular-nums text-emerald-700">
          {formatCurrency(l.neto)}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: 'w-24',
      render: (l) =>
        l.anulado ? (
          <StatusBadge label="Anulado" variant="danger" />
        ) : l.pagado ? (
          <StatusBadge label="Pagado" variant="info" />
        ) : (
          <StatusBadge label="Pendiente" variant="warning" />
        ),
    },
    {
      key: 'acciones',
      header: '',
      width: 'w-28',
      render: (l) =>
        !l.anulado && !l.pagado && hasPermission('pagos:write') ? (
          <Link
            to={`/pagos?libramiento=${l.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <Banknote size={11} /> Pagar
          </Link>
        ) : null,
    },
  ];

  const quickActions = [
    {
      id: 'nuevo-exp',
      label: 'Nuevo expediente',
      description: 'Registrar un expediente de gasto',
      icon: FolderOpen,
      to: '/expedientes?nuevo=1',
      permission: 'expedientes:write',
      accent: 'bg-primary-50 text-primary-800 border-primary-200 hover:border-primary-400',
    },
    {
      id: 'nueva-af',
      label: 'Nueva afectación',
      description: 'Afectar presupuesto a un expediente',
      icon: Receipt,
      to: '/afectaciones?nuevo=1',
      permission: 'afectaciones:write',
      accent: 'bg-amber-50 text-amber-900 border-amber-200 hover:border-amber-400',
    },
    {
      id: 'nuevo-lib',
      label: 'Nuevo libramiento',
      description: 'Emitir orden de pago',
      icon: FileText,
      to: '/libramientos?nuevo=1',
      permission: 'libramientos:write',
      accent: 'bg-sky-50 text-sky-900 border-sky-200 hover:border-sky-400',
    },
    {
      id: 'nuevo-pago',
      label: 'Registrar pago',
      description: 'Pagar un libramiento pendiente',
      icon: Banknote,
      to: '/pagos?nuevo=1',
      permission: 'pagos:write',
      accent: 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:border-emerald-400',
    },
  ].filter((a) => hasPermission(a.permission));

  return (
    <div className="space-y-4 pb-8">
      <SpreadsheetShell
        title="Inicio"
        subtitle={`Bienvenido, ${user?.nombre ?? 'usuario'}. Contaduría Municipal de Trancas.`}
      >
        <div className="px-4 py-3 text-sm text-slate-500">
          Buscá documentos al instante o usá los accesos rápidos para crear registros.
        </div>
      </SpreadsheetShell>

      <SpreadsheetStatCards
        onSelect={(id) => {
          const route = STAT_ROUTES[id];
          if (route) navigate(route);
        }}
        cards={[
          {
            id: 'expedientes',
            label: 'Expedientes',
            value: loadingStats ? '—' : (stats?.expedientes ?? 0),
            valueClassName: 'text-primary-800',
          },
          {
            id: 'afectaciones',
            label: 'Afectaciones',
            value: loadingStats ? '—' : (stats?.afectaciones ?? 0),
            valueClassName: 'text-amber-700',
          },
          {
            id: 'libramientos',
            label: 'Libramientos',
            value: loadingStats ? '—' : (stats?.libramientos ?? 0),
            valueClassName: 'text-sky-700',
          },
          {
            id: 'pagosPendientes',
            label: 'Pagos pendientes',
            value: loadingStats ? '—' : (stats?.pagosPendientes ?? 0),
            valueClassName: 'text-orange-700',
          },
        ]}
      />

      {/* Búsqueda rápida */}
      <SpreadsheetSection
        title="Búsqueda rápida"
        toolbar={
          searchKind ? (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              <ArrowLeft size={14} />
              Volver a opciones
            </button>
          ) : undefined
        }
      >
        {!searchKind ? (
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            {availableCards.length === 0 ? (
              <p className="col-span-full text-sm text-slate-500">
                No tenés permisos de lectura para buscar documentos.
              </p>
            ) : (
              availableCards.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => selectKind(card.id)}
                    className="group flex flex-col items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-primary-400 hover:bg-primary-50/40 hover:shadow-sm"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-800 group-hover:bg-primary-200">
                      <Icon size={20} />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">
                        {card.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {card.description}
                      </span>
                    </span>
                    <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-primary-700">
                      <Search size={12} /> Buscar
                    </span>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-0">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-[#f8fafc] px-4 py-3">
              {activeCard && (
                <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700">
                  {(() => {
                    const KindIcon = activeCard.icon;
                    return <KindIcon size={14} className="text-primary-700" />;
                  })()}
                  {activeCard.title}
                </span>
              )}
              <div className="relative min-w-[240px] flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  ref={inputRef}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={activeCard?.placeholder}
                  className={`${spreadsheet.filterInput} w-full pl-9`}
                  autoComplete="off"
                />
              </div>
            </div>

            {search.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                Escribí para buscar. Los resultados aparecen automáticamente.
              </div>
            ) : searchKind === 'expediente' ? (
              <SpreadsheetGrid
                columns={expColumns}
                data={expResults?.data ?? []}
                rowKey={(e) => e.id}
                loading={isSearching}
                emptyMessage="Sin expedientes que coincidan"
                onRowClick={(e) => navigate(`/expedientes/${e.id}`)}
                showRowNumbers={false}
              />
            ) : searchKind === 'afectacion' ? (
              <SpreadsheetGrid
                columns={afColumns}
                data={afResults?.data ?? []}
                rowKey={(a) => a.id}
                loading={isSearching}
                emptyMessage="Sin afectaciones que coincidan"
                onRowClick={(a) => navigate(`/afectaciones/${a.id}`)}
                showRowNumbers={false}
              />
            ) : (
              <SpreadsheetGrid
                columns={libColumns}
                data={libResults?.data ?? []}
                rowKey={(l) => l.id}
                loading={isSearching}
                emptyMessage="Sin libramientos que coincidan"
                onRowClick={(l) => navigate(`/libramientos/${l.id}`)}
                showRowNumbers={false}
              />
            )}

            {search.length > 0 && !isSearching && (
              <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
                {searchKind === 'expediente' &&
                  `${expResults?.total ?? 0} resultado(s) · clic en una fila para abrir el detalle`}
                {searchKind === 'afectacion' &&
                  `${afResults?.total ?? 0} resultado(s) · clic en una fila para abrir el detalle`}
                {searchKind === 'libramiento' &&
                  `${libResults?.total ?? 0} resultado(s) · clic en una fila para abrir el detalle`}
              </div>
            )}
          </div>
        )}
      </SpreadsheetSection>

      {/* Accesos rápidos */}
      {quickActions.length > 0 && (
        <SpreadsheetSection title="Accesos rápidos">
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => navigate(action.to)}
                  className={`flex items-start gap-3 rounded-lg border p-4 text-left transition ${action.accent}`}
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/80 shadow-sm">
                    <Icon size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{action.label}</span>
                    <span className="mt-0.5 block text-xs opacity-80">{action.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </SpreadsheetSection>
      )}
    </div>
  );
}
