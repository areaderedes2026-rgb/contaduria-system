import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useNavigate, Link, useBlocker, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Pencil,
  Trash2,
  Check,
  X,
  Wallet,
} from 'lucide-react';
import {
  getCuenta,
  getCuentaHistorial,
  getCuentaHijos,
  getCuentaAfectaciones,
  getCuentaMovimientos,
  getCuentasPadres,
  updateCuenta,
  ajustarSaldoCuenta,
  deleteCuenta,
} from '@/services/cuentas.service';
import { CuentaPadreCombobox } from '@/components/cuentas/CuentaPadreCombobox';
import {
  SpreadsheetShell,
  SpreadsheetGrid,
  SpreadsheetFormError,
  StatusBadge,
  cellInput,
  cellSelect,
  spreadsheet,
  type SpreadsheetColumn,
} from '@/components/spreadsheet';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { useAuthStore } from '@/stores/authStore';
import {
  formatCurrency,
  formatDate,
  toImporteInput,
  parseImporteAR,
  TIPO_CUENTA_LABELS,
  ESTADO_CUENTA_LABELS,
} from '@/utils/format';
import { ImporteInput } from '@/components/ui/ImporteInput';
import { getPlanCuentasListPath } from '@/utils/planCuentasListState';
import { buildReturnState } from '@/utils/navigationReturn';
import { DetailBackNav } from '@/components/layout/DetailBackNav';
import { ApiClientError } from '@/services/api';
import type {
  Cuenta,
  CuentaAfectacionVinculo,
  CuentaHistorial,
  CuentaMovimiento,
  CuentaPadreOption,
} from '@/types';

type TabId = 'datos' | 'subcuentas' | 'afectaciones' | 'libramientos' | 'historial';
type EditableField = 'codigo' | 'descripcion' | 'tipo' | 'padre' | 'estado';

interface DraftState {
  codigo: string;
  descripcion: string;
  tipo: string;
  estado: string;
  padre: CuentaPadreOption | null;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'datos', label: 'Datos' },
  { id: 'subcuentas', label: 'Subcuentas' },
  { id: 'afectaciones', label: 'Afectaciones' },
  { id: 'libramientos', label: 'Libramientos' },
  { id: 'historial', label: 'Historial' },
];

function parseTab(value: string | null): TabId {
  if (
    value === 'subcuentas' ||
    value === 'afectaciones' ||
    value === 'libramientos' ||
    value === 'historial' ||
    value === 'datos'
  ) {
    return value;
  }
  return 'datos';
}

const ACCION_LABELS: Record<string, string> = {
  ALTA: 'Alta',
  MODIFICACION: 'Modificación',
  AJUSTE_SALDO: 'Ajuste de saldo',
  ELIMINACION: 'Eliminación',
};

const CAMPO_LABELS: Record<string, string> = {
  codigo: 'Código',
  descripcion: 'Descripción',
  tipo: 'Tipo',
  estado: 'Estado',
  saldo_inicial: 'Saldo inicial',
  cuenta_padre_id: 'Cuenta padre',
};

function draftFromCuenta(
  cuenta: Cuenta,
  padres: CuentaPadreOption[]
): DraftState {
  return {
    codigo: cuenta.codigo,
    descripcion: cuenta.descripcion,
    tipo: cuenta.tipo,
    estado: cuenta.estado,
    padre: cuenta.cuenta_padre_id
      ? padres.find((p) => p.id === cuenta.cuenta_padre_id) ??
        (cuenta.cuenta_padre_codigo
          ? {
              id: cuenta.cuenta_padre_id,
              codigo: cuenta.cuenta_padre_codigo,
              descripcion: '',
              nivel: Math.max(1, cuenta.nivel - 1),
            }
          : null)
      : null,
  };
}

export function CuentaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission('cuentas:write'));

  const cuentaId = Number(id);

  const [tab, setTab] = useState<TabId>(() => parseTab(searchParams.get('tab')));
  const [deleteModal, setDeleteModal] = useState(false);
  const [ajusteModal, setAjusteModal] = useState(false);
  const [leaveModal, setLeaveModal] = useState(false);
  const [formError, setFormError] = useState('');
  const [ajusteSaldo, setAjusteSaldo] = useState('');
  const [ajusteMotivo, setAjusteMotivo] = useState('');

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [editingFields, setEditingFields] = useState<Set<EditableField>>(new Set());
  const [baselineKey, setBaselineKey] = useState('');

  useEffect(() => {
    const fromUrl = parseTab(searchParams.get('tab'));
    if (fromUrl !== tab) setTab(fromUrl);
    // Solo reaccionar a cambios externos de URL (ej. Volver desde otra página)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const selectTab = (next: TabId) => {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    if (next === 'datos') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  const cuentaReturnPath = (tabId: TabId) => {
    const base = `/plan-cuentas/${cuentaId}`;
    return tabId === 'datos' ? base : `${base}?tab=${tabId}`;
  };

  const { data: cuenta, isLoading, error } = useQuery({
    queryKey: ['cuenta', cuentaId],
    queryFn: () => getCuenta(cuentaId),
    enabled: !isNaN(cuentaId),
  });

  const { data: padres = [] } = useQuery({
    queryKey: ['cuentas-padres'],
    queryFn: getCuentasPadres,
    enabled: !isNaN(cuentaId),
  });

  const { data: historial } = useQuery({
    queryKey: ['cuenta-historial', cuentaId],
    queryFn: () => getCuentaHistorial(cuentaId),
    enabled: !isNaN(cuentaId),
  });

  const { data: hijos } = useQuery({
    queryKey: ['cuenta-hijos', cuentaId],
    queryFn: () => getCuentaHijos(cuentaId),
    enabled: !isNaN(cuentaId),
  });

  const { data: afectaciones } = useQuery({
    queryKey: ['cuenta-afectaciones', cuentaId],
    queryFn: () => getCuentaAfectaciones(cuentaId),
    enabled: !isNaN(cuentaId),
  });

  const { data: movimientos } = useQuery({
    queryKey: ['cuenta-movimientos', cuentaId],
    queryFn: () => getCuentaMovimientos(cuentaId),
    enabled: !isNaN(cuentaId),
  });

  useEffect(() => {
    if (!cuenta) return;
    const key = `${cuenta.id}-${cuenta.updated_at}`;
    if (key === baselineKey) return;
    setDraft(draftFromCuenta(cuenta, padres));
    setEditingFields(new Set());
    setBaselineKey(key);
    setFormError('');
  }, [cuenta, padres, baselineKey]);

  const isDirty = useMemo(() => {
    if (!cuenta || !draft) return false;
    const padreId = draft.padre?.id ?? null;
    return (
      draft.codigo.trim() !== cuenta.codigo ||
      draft.descripcion.trim() !== cuenta.descripcion ||
      draft.tipo !== cuenta.tipo ||
      draft.estado !== cuenta.estado ||
      padreId !== cuenta.cuenta_padre_id
    );
  }, [cuenta, draft]);

  const blocker = useBlocker(isDirty);

  useEffect(() => {
    if (blocker.state === 'blocked') setLeaveModal(true);
  }, [blocker.state]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['cuenta', cuentaId] });
    queryClient.invalidateQueries({ queryKey: ['cuenta-historial', cuentaId] });
    queryClient.invalidateQueries({ queryKey: ['cuenta-hijos', cuentaId] });
    queryClient.invalidateQueries({ queryKey: ['cuenta-afectaciones', cuentaId] });
    queryClient.invalidateQueries({ queryKey: ['cuenta-movimientos', cuentaId] });
    queryClient.invalidateQueries({ queryKey: ['cuentas'] });
    queryClient.invalidateQueries({ queryKey: ['cuentas-arbol'] });
    queryClient.invalidateQueries({ queryKey: ['cuentas-padres'] });
    queryClient.invalidateQueries({ queryKey: ['cuentas-resumen'] });
    queryClient.invalidateQueries({ queryKey: ['cuentas-disponibles'] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error('Sin datos');
      return updateCuenta(cuentaId, {
        codigo: draft.codigo.trim(),
        descripcion: draft.descripcion.trim(),
        tipo: draft.tipo,
        estado: draft.estado,
        cuenta_padre_id: draft.padre?.id ?? null,
      });
    },
    onSuccess: () => {
      setEditingFields(new Set());
      setFormError('');
      setBaselineKey('');
      invalidate();
    },
    onError: (err) =>
      setFormError(err instanceof ApiClientError ? err.message : 'Error al guardar'),
  });

  const ajusteMutation = useMutation({
    mutationFn: () =>
      ajustarSaldoCuenta(cuentaId, {
        saldo_inicial: parseImporteAR(ajusteSaldo),
        motivo: ajusteMotivo.trim(),
      }),
    onSuccess: () => {
      setAjusteModal(false);
      setAjusteMotivo('');
      setFormError('');
      setBaselineKey('');
      invalidate();
    },
    onError: (err) =>
      setFormError(err instanceof ApiClientError ? err.message : 'Error al ajustar saldo'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCuenta(cuentaId),
    onSuccess: () => {
      invalidate();
      navigate('/plan-cuentas');
    },
    onError: (err) =>
      setFormError(err instanceof ApiClientError ? err.message : 'Error al eliminar'),
  });

  const discardChanges = () => {
    if (!cuenta) return;
    setDraft(draftFromCuenta(cuenta, padres));
    setEditingFields(new Set());
    setFormError('');
  };

  const confirmLeave = () => {
    setLeaveModal(false);
    if (blocker.state === 'blocked') blocker.proceed();
  };

  const cancelLeave = () => {
    setLeaveModal(false);
    if (blocker.state === 'blocked') blocker.reset();
  };

  const startEdit = (field: EditableField) => {
    if (!canWrite) return;
    setEditingFields((prev) => new Set(prev).add(field));
  };

  const stopEdit = (field: EditableField) => {
    setEditingFields((prev) => {
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  };

  const renderEditableCell = (
    field: EditableField,
    display: ReactNode,
    editor: ReactNode,
    alignTop = false
  ) => {
    const editing = editingFields.has(field);
    return (
      <div
        className={`group flex items-start gap-2 ${alignTop ? '' : 'items-center'}`}
        onClick={() => {
          if (canWrite && !editing) startEdit(field);
        }}
      >
        <div className="min-w-0 flex-1">{editing ? editor : display}</div>
        {canWrite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (editing) stopEdit(field);
              else startEdit(field);
            }}
            className={`shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-primary-700 ${
              editing ? 'bg-primary-50 text-primary-700' : 'opacity-0 group-hover:opacity-100'
            }`}
            title={editing ? 'Cerrar edición' : 'Editar'}
          >
            <Pencil size={14} />
          </button>
        )}
      </div>
    );
  };

  const afectacionesActivas = (afectaciones ?? []).filter((a) => !a.anulada);
  const importeAfectadoLineas = afectacionesActivas.reduce(
    (s, a) => s + Number(a.importe_linea),
    0
  );

  const hijosColumns: SpreadsheetColumn<Cuenta>[] = [
    {
      key: 'codigo',
      header: 'Código',
      width: 'w-36',
      render: (c) => (
        <Link
          to={`/plan-cuentas/${c.id}`}
          className="font-mono font-semibold text-primary-700 hover:underline"
        >
          {c.codigo}
        </Link>
      ),
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      render: (c) => c.descripcion,
    },
    {
      key: 'tipo',
      header: 'Tipo',
      width: 'w-28',
      render: (c) => (
        <StatusBadge label={TIPO_CUENTA_LABELS[c.tipo] ?? c.tipo} variant="info" />
      ),
    },
    {
      key: 'disponible',
      header: 'Disponible',
      width: 'w-32',
      align: 'right',
      render: (c) => (
        <span className="font-medium tabular-nums text-emerald-700">
          {formatCurrency(c.saldo_disponible)}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: 'w-24',
      render: (c) => (
        <StatusBadge
          label={ESTADO_CUENTA_LABELS[c.estado]}
          variant={c.estado === 'ACTIVA' ? 'success' : 'danger'}
        />
      ),
    },
  ];

  const afectacionColumns: SpreadsheetColumn<CuentaAfectacionVinculo>[] = [
    {
      key: 'numero',
      header: 'Afectación',
      width: 'w-28',
      render: (a) => (
        <Link
          to={`/afectaciones/${a.id}`}
          state={buildReturnState(cuentaReturnPath('afectaciones'))}
          className="font-mono font-semibold text-primary-700 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {a.numero_completo}
        </Link>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      width: 'w-24',
      render: (a) => <span className="tabular-nums">{formatDate(a.fecha)}</span>,
    },
    {
      key: 'expediente',
      header: 'Expediente',
      width: 'w-28',
      render: (a) => (
        <Link
          to={`/expedientes/${a.expediente_id}`}
          className="font-mono text-primary-700 hover:underline"
        >
          {a.expediente_numero}
        </Link>
      ),
    },
    {
      key: 'destinatario',
      header: 'Destinatario',
      render: (a) => a.destinatario,
    },
    {
      key: 'importe',
      header: 'Importe en cuenta',
      width: 'w-36',
      align: 'right',
      render: (a) => (
        <span className="font-medium tabular-nums">{formatCurrency(a.importe_linea)}</span>
      ),
    },
    {
      key: 'obs',
      header: 'Observaciones',
      render: (a) => a.observaciones || <span className="text-slate-400">—</span>,
    },
    {
      key: 'estado',
      header: 'Estado',
      width: 'w-24',
      render: (a) =>
        a.anulada ? (
          <StatusBadge label="Anulada" variant="danger" />
        ) : (
          <StatusBadge label="Activa" variant="success" />
        ),
    },
  ];

  const movimientoColumns: SpreadsheetColumn<CuentaMovimiento>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      width: 'w-24',
      render: (m) => <span className="tabular-nums">{formatDate(m.fecha)}</span>,
    },
    {
      key: 'documento',
      header: 'Libramiento',
      width: 'w-32',
      render: (m) => (
        <Link
          to={`/libramientos/${m.documento_id}`}
          state={buildReturnState(cuentaReturnPath('libramientos'))}
          className="font-mono font-semibold text-primary-700 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {m.documento_numero}
        </Link>
      ),
    },
    {
      key: 'expediente',
      header: 'Expediente',
      width: 'w-28',
      render: (m) =>
        m.expediente_id ? (
          <Link
            to={`/expedientes/${m.expediente_id}`}
            className="font-mono text-primary-700 hover:underline"
          >
            {m.expediente_numero}
          </Link>
        ) : (
          '—'
        ),
    },
    {
      key: 'beneficiario',
      header: 'Beneficiario',
      render: (m) => m.beneficiario,
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
      key: 'pago',
      header: 'Pago',
      width: 'w-32',
      render: (m) =>
        m.pagado && m.pago_id ? (
          <Link
            to={`/pagos/${m.pago_id}`}
            className="font-mono text-emerald-700 hover:underline"
          >
            {m.pago_numero ?? 'Pagado'}
          </Link>
        ) : (
          <span className="text-slate-400">Pendiente</span>
        ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: 'w-24',
      render: (m) =>
        m.anulado ? (
          <StatusBadge label="Anulado" variant="danger" />
        ) : m.pagado ? (
          <StatusBadge label="Pagado" variant="success" />
        ) : (
          <StatusBadge label="Activo" variant="info" />
        ),
    },
  ];

  const historialColumns: SpreadsheetColumn<CuentaHistorial>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      width: 'w-36',
      render: (h) => (
        <span className="tabular-nums text-xs">{formatDate(h.created_at.slice(0, 10))}</span>
      ),
    },
    {
      key: 'accion',
      header: 'Acción',
      width: 'w-36',
      render: (h) => ACCION_LABELS[h.accion] ?? h.accion,
    },
    {
      key: 'campo',
      header: 'Campo',
      width: 'w-32',
      render: (h) =>
        h.campo ? CAMPO_LABELS[h.campo] ?? h.campo : <span className="text-slate-400">—</span>,
    },
    {
      key: 'cambio',
      header: 'Cambio',
      render: (h) => {
        if (!h.valor_anterior && !h.valor_nuevo) {
          return h.observacion || <span className="text-slate-400">—</span>;
        }
        return (
          <span className="text-sm">
            <span className="text-slate-500">{h.valor_anterior || '—'}</span>
            {' → '}
            <span className="font-medium text-slate-800">{h.valor_nuevo || '—'}</span>
            {h.observacion ? (
              <span className="mt-0.5 block text-xs text-slate-500">{h.observacion}</span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'usuario',
      header: 'Usuario',
      width: 'w-36',
      render: (h) => h.usuario_nombre ?? '—',
    },
  ];

  if (isLoading || !draft) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-500">
        Cargando cuenta...
      </div>
    );
  }

  if (error || !cuenta) {
    return (
      <div className="space-y-4">
        <DetailBackNav
          listTo={getPlanCuentasListPath()}
          listLabel="Volver al plan de cuentas"
        />
        <Alert type="error">
          {error instanceof ApiClientError ? error.message : 'Cuenta no encontrada'}
        </Alert>
      </div>
    );
  }

  const codigoBloqueado = Number(cuenta.saldo_afectado) > 0 || (hijos?.length ?? 0) > 0;

  const rows: { label: string; value: ReactNode }[] = [
    {
      label: 'Código',
      value: codigoBloqueado ? (
        <div>
          <span className="font-mono text-lg font-bold text-primary-900">{cuenta.codigo}</span>
          <p className="mt-1 text-[11px] text-slate-500">
            No editable: la cuenta tiene saldo afectado o subcuentas.
          </p>
        </div>
      ) : (
        renderEditableCell(
          'codigo',
          <span className="font-mono text-lg font-bold text-primary-900">{draft.codigo}</span>,
          <input
            value={draft.codigo}
            onChange={(e) =>
              setDraft({ ...draft, codigo: e.target.value.replace(/\s/g, '') })
            }
            className={`${cellInput} font-mono text-base font-semibold`}
          />
        )
      ),
    },
    {
      label: 'Descripción',
      value: renderEditableCell(
        'descripcion',
        <span className="font-medium">{draft.descripcion}</span>,
        <textarea
          value={draft.descripcion}
          onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })}
          rows={2}
          className="w-full min-w-0 resize-none rounded-none border-0 bg-transparent px-2 py-1.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500/40"
        />,
        true
      ),
    },
    {
      label: 'Tipo',
      value: renderEditableCell(
        'tipo',
        <StatusBadge label={TIPO_CUENTA_LABELS[draft.tipo] ?? draft.tipo} variant="info" />,
        <select
          value={draft.tipo}
          onChange={(e) => setDraft({ ...draft, tipo: e.target.value })}
          className={cellSelect}
        >
          <option value="RECURSO">Recurso</option>
          <option value="GASTO">Gasto</option>
          <option value="PATRIMONIAL">Patrimonial</option>
        </select>
      ),
    },
    {
      label: 'Cuenta padre',
      value: renderEditableCell(
        'padre',
        draft.padre ? (
          <Link
            to={`/plan-cuentas/${draft.padre.id}`}
            className="font-mono text-primary-700 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {draft.padre.codigo}
            {draft.padre.descripcion ? ` — ${draft.padre.descripcion}` : ''}
          </Link>
        ) : (
          <span className="text-slate-500">Nivel raíz</span>
        ),
        <CuentaPadreCombobox
          value={draft.padre}
          onChange={(padre) => setDraft({ ...draft, padre })}
          options={padres}
          excludeId={cuenta.id}
          variant="cell"
        />,
        true
      ),
    },
    {
      label: 'Nivel',
      value: <span className="tabular-nums">{cuenta.nivel}</span>,
    },
    {
      label: 'Saldo inicial',
      value: (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-base font-semibold tabular-nums text-primary-800">
            {formatCurrency(cuenta.saldo_inicial)}
          </span>
          {canWrite && (
            <button
              type="button"
              onClick={() => {
                setAjusteSaldo(toImporteInput(Number(cuenta.saldo_inicial)));
                setAjusteMotivo('');
                setFormError('');
                setAjusteModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Wallet size={13} /> Ajustar saldo
            </button>
          )}
        </div>
      ),
    },
    {
      label: 'Saldo afectado',
      value: (
        <span className="font-medium tabular-nums text-amber-700">
          {formatCurrency(cuenta.saldo_afectado)}
        </span>
      ),
    },
    {
      label: 'Saldo disponible',
      value: (
        <span className="text-base font-bold tabular-nums text-emerald-700">
          {formatCurrency(cuenta.saldo_disponible)}
        </span>
      ),
    },
    {
      label: 'Afectaciones activas',
      value: (
        <button
          type="button"
          onClick={() => selectTab('afectaciones')}
          className="font-medium tabular-nums text-primary-700 hover:underline"
        >
          {afectacionesActivas.length}
        </button>
      ),
    },
    {
      label: 'Estado',
      value: renderEditableCell(
        'estado',
        <StatusBadge
          label={ESTADO_CUENTA_LABELS[draft.estado]}
          variant={draft.estado === 'ACTIVA' ? 'success' : 'danger'}
        />,
        <select
          value={draft.estado}
          onChange={(e) => setDraft({ ...draft, estado: e.target.value })}
          className={cellSelect}
        >
          <option value="ACTIVA">Activa</option>
          <option value="INACTIVA">Inactiva</option>
        </select>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <DetailBackNav
        listTo={getPlanCuentasListPath()}
        listLabel="Volver al plan de cuentas"
      />

      {formError && tab === 'datos' && !ajusteModal && (
        <SpreadsheetFormError>{formError}</SpreadsheetFormError>
      )}

      <SpreadsheetShell
        title={cuenta.codigo}
        subtitle={cuenta.descripcion}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isDirty && (
              <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                Cambios sin guardar
              </span>
            )}
            {canWrite && isDirty && (
              <>
                <Button type="button" variant="secondary" size="sm" onClick={discardChanges}>
                  <X size={14} /> Descartar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="!bg-emerald-600 hover:!bg-emerald-700"
                  loading={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  <Check size={14} /> Guardar cambios
                </Button>
              </>
            )}
            {canWrite && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  setFormError('');
                  setDeleteModal(true);
                }}
              >
                <Trash2 size={14} /> Eliminar
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 px-3 pt-2">
          {TABS.map((t) => {
            const count =
              t.id === 'subcuentas'
                ? hijos?.length
                : t.id === 'afectaciones'
                  ? afectaciones?.length
                  : t.id === 'libramientos'
                    ? movimientos?.length
                    : t.id === 'historial'
                      ? historial?.length
                      : undefined;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTab(t.id)}
                className={`rounded-t-md px-3 py-2 text-sm font-medium transition ${
                  tab === t.id
                    ? 'border border-b-0 border-slate-300 bg-white text-primary-800'
                    : 'text-slate-600 hover:bg-white/70 hover:text-slate-800'
                }`}
              >
                {t.label}
                {count !== undefined ? (
                  <span className="ml-1.5 tabular-nums text-slate-400">({count})</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {tab === 'datos' && (
          <table className={`${spreadsheet.table} border-0`}>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td className={`${spreadsheet.headerCell} w-52 bg-[#f1f5f9] font-medium`}>
                    {row.label}
                  </td>
                  <td className={spreadsheet.bodyCell}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'subcuentas' && (
          <SpreadsheetGrid
            columns={hijosColumns}
            data={hijos ?? []}
            rowKey={(c) => c.id}
            showRowNumbers
            emptyMessage="Esta cuenta no tiene subcuentas"
            onRowClick={(c) => navigate(`/plan-cuentas/${c.id}`)}
          />
        )}

        {tab === 'afectaciones' && (
          <>
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
              Compromisos presupuestarios que reservaron fondos de esta cuenta ·{' '}
              {afectacionesActivas.length} activa
              {afectacionesActivas.length !== 1 ? 's' : ''} ·{' '}
              {formatCurrency(importeAfectadoLineas)}
            </div>
            <SpreadsheetGrid
              columns={afectacionColumns}
              data={afectaciones ?? []}
              rowKey={(a) => `${a.id}-${a.importe_linea}`}
              showRowNumbers
              emptyMessage="Sin afectaciones vinculadas a esta cuenta"
              onRowClick={(a) =>
                navigate(`/afectaciones/${a.id}`, {
                  state: buildReturnState(cuentaReturnPath('afectaciones')),
                })
              }
            />
          </>
        )}

        {tab === 'libramientos' && (
          <>
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
              Órdenes de pago emitidas sobre esta cuenta (etapa posterior a la afectación)
            </div>
            <SpreadsheetGrid
              columns={movimientoColumns}
              data={movimientos ?? []}
              rowKey={(m) => `${m.documento_id}-${m.importe}-${m.fecha}`}
              showRowNumbers
              emptyMessage="Sin libramientos. Cuando se libre una afectación de esta cuenta, aparecerá acá."
              onRowClick={(m) =>
                navigate(`/libramientos/${m.documento_id}`, {
                  state: buildReturnState(cuentaReturnPath('libramientos')),
                })
              }
            />
          </>
        )}

        {tab === 'historial' && (
          <SpreadsheetGrid
            columns={historialColumns}
            data={historial ?? []}
            rowKey={(h) => h.id}
            showRowNumbers
            emptyMessage="Sin historial registrado"
          />
        )}
      </SpreadsheetShell>

      <Modal open={leaveModal} onClose={cancelLeave} title="Cambios sin guardar" size="sm">
        <p className="mb-6 text-sm text-slate-600">
          Tiene cambios sin guardar en la cuenta. Si sale ahora, se perderán.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={cancelLeave}>
            Seguir editando
          </Button>
          <Button variant="danger" onClick={confirmLeave}>
            Salir sin guardar
          </Button>
        </div>
      </Modal>

      <Modal
        open={ajusteModal}
        onClose={() => setAjusteModal(false)}
        title="Ajustar saldo inicial"
        size="md"
      >
        {formError && (
          <div className="mb-4">
            <Alert type="error">{formError}</Alert>
          </div>
        )}
        <p className="mb-4 text-sm text-slate-600">
          Saldo actual: <strong>{formatCurrency(cuenta.saldo_inicial)}</strong> · Afectado:{' '}
          <strong>{formatCurrency(cuenta.saldo_afectado)}</strong>. El nuevo saldo no puede ser
          menor al afectado. Quedará registrado en el historial.
        </p>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Nuevo saldo inicial
        </label>
        <ImporteInput
          value={ajusteSaldo}
          onChange={setAjusteSaldo}
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          placeholder="0,00"
        />
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Motivo del ajuste
        </label>
        <textarea
          value={ajusteMotivo}
          onChange={(e) => setAjusteMotivo(e.target.value)}
          rows={3}
          className="mb-6 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          placeholder="Ej: ampliación presupuestaria / reasignación / corrección..."
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setAjusteModal(false)}>
            Cancelar
          </Button>
          <Button
            loading={ajusteMutation.isPending}
            disabled={
              !ajusteMotivo.trim() ||
              ajusteMotivo.trim().length < 3 ||
              Number.isNaN(parseImporteAR(ajusteSaldo))
            }
            onClick={() => ajusteMutation.mutate()}
          >
            Confirmar ajuste
          </Button>
        </div>
      </Modal>

      <Modal open={deleteModal} onClose={() => setDeleteModal(false)} title="Eliminar cuenta" size="sm">
        {formError && (
          <div className="mb-4">
            <Alert type="error">{formError}</Alert>
          </div>
        )}
        <p className="mb-6 text-sm text-slate-600">
          ¿Eliminar la cuenta <strong className="font-mono">{cuenta.codigo}</strong>? Solo es
          posible si no tiene subcuentas ni saldo afectado.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteModal(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
