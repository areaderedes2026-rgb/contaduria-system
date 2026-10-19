import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  useParams,
  useNavigate,
  useBlocker,
  useSearchParams,
} from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, Ban, Check, X, AlertTriangle } from 'lucide-react';
import {
  getProveedor,
  getProveedorHistorial,
  getProveedorResumen,
  updateProveedor,
  deleteProveedor,
} from '@/services/proveedores.service';
import { getExpedientes } from '@/services/expedientes.service';
import { ACCION_LABELS, ACCION_COLORS } from '@/services/auditoria.service';
import { EstadoExpedienteBadge } from '@/components/expedientes/EstadoExpedienteBadge';
import { DetailBackNav } from '@/components/layout/DetailBackNav';
import {
  SpreadsheetShell,
  SpreadsheetGrid,
  SpreadsheetFormError,
  StatusBadge,
  cellInput,
  spreadsheet,
  type SpreadsheetColumn,
} from '@/components/spreadsheet';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import {
  formatCurrency,
  formatDate,
  ESTADO_EXPEDIENTE_LABELS,
} from '@/utils/format';
import { buildReturnState } from '@/utils/navigationReturn';
import { ApiClientError } from '@/services/api';
import type { AuditoriaRegistro, Expediente, Proveedor } from '@/types';

type TabId = 'datos' | 'expedientes' | 'historial';
type EditableField = 'nombre' | 'documento' | 'domicilio' | 'telefono' | 'estado';

interface DraftState {
  nombre: string;
  documento: string;
  domicilio: string;
  telefono: string;
  activo: boolean;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'datos', label: 'Datos' },
  { id: 'expedientes', label: 'Expedientes' },
  { id: 'historial', label: 'Historial' },
];

function parseTab(value: string | null): TabId {
  if (value === 'expedientes' || value === 'historial' || value === 'datos') {
    return value;
  }
  return 'datos';
}

function draftFromProveedor(p: Proveedor): DraftState {
  return {
    nombre: p.nombre,
    documento: p.documento ?? '',
    domicilio: p.domicilio ?? '',
    telefono: p.telefono ?? '',
    activo: p.activo,
  };
}

function formatCambios(cambios: Record<string, unknown> | null): string {
  if (!cambios || Object.keys(cambios).length === 0) return '—';
  return Object.entries(cambios)
    .map(([key, value]) => `${key}: ${value == null ? '—' : String(value)}`)
    .join(' · ');
}

export function ProveedorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission('proveedores:write'));
  const canReadExpedientes = useAuthStore((s) => s.hasPermission('expedientes:read'));

  const proveedorId = Number(id);

  const [tab, setTab] = useState<TabId>(() => parseTab(searchParams.get('tab')));
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [editingFields, setEditingFields] = useState<Set<EditableField>>(new Set());
  const [baselineKey, setBaselineKey] = useState('');
  const [formError, setFormError] = useState('');
  const [deleteModal, setDeleteModal] = useState(false);
  const [deactivateModal, setDeactivateModal] = useState(false);
  const [leaveModal, setLeaveModal] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const fromUrl = parseTab(searchParams.get('tab'));
    if (fromUrl !== tab) setTab(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const selectTab = (next: TabId) => {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    if (next === 'datos') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  const proveedorReturnPath = (tabId: TabId) => {
    const base = `/proveedores/${proveedorId}`;
    return tabId === 'datos' ? base : `${base}?tab=${tabId}`;
  };

  const { data: proveedor, isLoading, error } = useQuery({
    queryKey: ['proveedor', proveedorId],
    queryFn: () => getProveedor(proveedorId),
    enabled: !isNaN(proveedorId),
  });

  const { data: resumen } = useQuery({
    queryKey: ['proveedor-resumen', proveedorId],
    queryFn: () => getProveedorResumen(proveedorId),
    enabled: !isNaN(proveedorId),
  });

  const { data: historial } = useQuery({
    queryKey: ['proveedor-historial', proveedorId],
    queryFn: () => getProveedorHistorial(proveedorId),
    enabled: !isNaN(proveedorId),
  });

  const { data: expedientesData, isLoading: loadingExpedientes } = useQuery({
    queryKey: ['expedientes', 'por-proveedor', proveedorId],
    queryFn: () =>
      getExpedientes({
        proveedorId,
        limit: 100,
        sortBy: 'fecha_ingreso',
        sortOrder: 'desc',
      }),
    enabled: !isNaN(proveedorId) && canReadExpedientes,
  });

  useEffect(() => {
    if (!proveedor) return;
    const key = `${proveedor.id}-${proveedor.updated_at}`;
    if (key === baselineKey) return;
    setDraft(draftFromProveedor(proveedor));
    setEditingFields(new Set());
    setFormError('');
    setBaselineKey(key);
  }, [proveedor, baselineKey]);

  const isDirty = useMemo(() => {
    if (!proveedor || !draft) return false;
    return (
      draft.nombre.trim() !== proveedor.nombre ||
      (draft.documento.trim() || null) !== (proveedor.documento ?? null) ||
      (draft.domicilio.trim() || null) !== (proveedor.domicilio ?? null) ||
      (draft.telefono.trim() || null) !== (proveedor.telefono ?? null) ||
      draft.activo !== proveedor.activo
    );
  }, [proveedor, draft]);

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
    queryClient.invalidateQueries({ queryKey: ['proveedor', proveedorId] });
    queryClient.invalidateQueries({ queryKey: ['proveedor-resumen', proveedorId] });
    queryClient.invalidateQueries({ queryKey: ['proveedor-historial', proveedorId] });
    queryClient.invalidateQueries({ queryKey: ['proveedores'] });
    queryClient.invalidateQueries({ queryKey: ['proveedores-activos'] });
    queryClient.invalidateQueries({ queryKey: ['expedientes', 'por-proveedor', proveedorId] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error('Sin datos');
      return updateProveedor(proveedorId, {
        nombre: draft.nombre.trim(),
        documento: draft.documento.trim() || null,
        domicilio: draft.domicilio.trim() || null,
        telefono: draft.telefono.trim() || null,
        activo: draft.activo,
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

  const deleteMutation = useMutation({
    mutationFn: () => deleteProveedor(proveedorId),
    onSuccess: () => {
      invalidate();
      navigate('/proveedores');
    },
    onError: (err) => {
      const inUse = err instanceof ApiClientError && err.code === 'PROVEEDOR_IN_USE';
      if (inUse) {
        setDeleteModal(false);
        setDeleteError('');
        setDeactivateModal(true);
        return;
      }
      setDeleteError(err instanceof ApiClientError ? err.message : 'Error al eliminar');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => updateProveedor(proveedorId, { activo: false }),
    onSuccess: () => {
      setDeactivateModal(false);
      setBaselineKey('');
      invalidate();
    },
    onError: (err) =>
      setFormError(err instanceof ApiClientError ? err.message : 'Error al desactivar'),
  });

  const discardChanges = () => {
    if (!proveedor) return;
    setDraft(draftFromProveedor(proveedor));
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

  const handleSave = () => {
    if (!draft?.nombre.trim()) {
      setFormError('El nombre es obligatorio');
      return;
    }
    setFormError('');
    saveMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        Cargando proveedor...
      </div>
    );
  }

  if (error || !proveedor || !draft) {
    return (
      <div className="space-y-4">
        <DetailBackNav listTo="/proveedores" listLabel="Volver a proveedores" />
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error instanceof ApiClientError
            ? error.message
            : 'No se pudo cargar el proveedor'}
        </div>
      </div>
    );
  }

  const expedientes = expedientesData?.data ?? [];
  const tieneExpedientes = (resumen?.totalExpedientes ?? 0) > 0 || expedientes.length > 0;

  const renderEditableCell = (
    field: EditableField,
    display: ReactNode,
    editor: ReactNode,
    alignTop = false
  ) => {
    const isEditing = editingFields.has(field);
    const canStartEdit = canWrite && !isEditing;

    return (
      <div
        role={canStartEdit ? 'button' : undefined}
        tabIndex={canStartEdit ? 0 : undefined}
        onClick={() => {
          if (canStartEdit) startEdit(field);
        }}
        onKeyDown={(e) => {
          if (!canStartEdit) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            startEdit(field);
          }
        }}
        className={`flex gap-2 ${alignTop ? 'items-start' : 'items-center'} ${
          canStartEdit ? 'cursor-pointer rounded-sm hover:bg-slate-50/80' : ''
        }`}
      >
        <div className="min-w-0 flex-1">{isEditing ? editor : display}</div>
        {canWrite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isEditing) stopEdit(field);
              else startEdit(field);
            }}
            className={`shrink-0 rounded p-1 transition ${
              isEditing
                ? 'bg-primary-100 text-primary-700'
                : 'text-slate-400 hover:bg-slate-100 hover:text-primary-600'
            }`}
            title={isEditing ? 'Cerrar edición del campo' : 'Editar campo'}
            aria-label={isEditing ? 'Cerrar edición' : 'Editar'}
          >
            <Pencil size={14} />
          </button>
        )}
      </div>
    );
  };

  const rows: { label: string; value: ReactNode }[] = [
    {
      label: 'Nombre',
      value: renderEditableCell(
        'nombre',
        <span className="font-medium text-slate-800">{draft.nombre}</span>,
        <input
          value={draft.nombre}
          onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
          className={cellInput}
          autoFocus
        />
      ),
    },
    {
      label: 'CUIT / DNI',
      value: renderEditableCell(
        'documento',
        <span className="font-mono text-slate-700">{draft.documento || '—'}</span>,
        <input
          value={draft.documento}
          onChange={(e) => setDraft({ ...draft, documento: e.target.value })}
          className={cellInput}
          placeholder="Opcional"
          autoFocus
        />
      ),
    },
    {
      label: 'Domicilio',
      value: renderEditableCell(
        'domicilio',
        <span className="text-slate-700">{draft.domicilio || '—'}</span>,
        <input
          value={draft.domicilio}
          onChange={(e) => setDraft({ ...draft, domicilio: e.target.value })}
          className={cellInput}
          placeholder="Opcional"
          autoFocus
        />
      ),
    },
    {
      label: 'Teléfono',
      value: renderEditableCell(
        'telefono',
        <span className="tabular-nums text-slate-700">{draft.telefono || '—'}</span>,
        <input
          value={draft.telefono}
          onChange={(e) => setDraft({ ...draft, telefono: e.target.value })}
          className={cellInput}
          placeholder="Opcional"
          autoFocus
        />
      ),
    },
    {
      label: 'Estado',
      value: renderEditableCell(
        'estado',
        <StatusBadge
          label={draft.activo ? 'Activo' : 'Inactivo'}
          variant={draft.activo ? 'success' : 'danger'}
        />,
        <label className="flex items-center gap-2 px-1 py-1 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={draft.activo}
            onChange={(e) => setDraft({ ...draft, activo: e.target.checked })}
            className="rounded border-border text-primary-600 focus:ring-primary-500"
            autoFocus
          />
          Proveedor activo
        </label>
      ),
    },
    {
      label: 'Expedientes',
      value: (
        <span className="tabular-nums text-slate-700">
          {resumen?.totalExpedientes ?? 0}
          {resumen && resumen.expedientesActivos > 0
            ? ` · ${resumen.expedientesActivos} activo${resumen.expedientesActivos !== 1 ? 's' : ''}`
            : ''}
        </span>
      ),
    },
    {
      label: 'Importe expedientes',
      value: (
        <span className="font-medium tabular-nums text-slate-800">
          {formatCurrency(resumen?.importeTotal ?? 0)}
        </span>
      ),
    },
    {
      label: 'Afectado',
      value: (
        <span className="font-medium tabular-nums text-amber-700">
          {formatCurrency(resumen?.importeAfectado ?? 0)}
        </span>
      ),
    },
    {
      label: 'Pagado',
      value: (
        <span className="font-semibold tabular-nums text-emerald-700">
          {formatCurrency(resumen?.importePagado ?? 0)}
        </span>
      ),
    },
    {
      label: 'Registrado',
      value: (
        <span className="tabular-nums">
          {new Date(proveedor.created_at).toLocaleString('es-AR')}
        </span>
      ),
    },
    {
      label: 'Actualizado',
      value: (
        <span className="tabular-nums">
          {new Date(proveedor.updated_at).toLocaleString('es-AR')}
        </span>
      ),
    },
  ];

  const expedienteColumns: SpreadsheetColumn<Expediente>[] = [
    {
      key: 'numero',
      header: 'Número',
      width: 'w-28',
      render: (exp) => (
        <span className="font-mono font-semibold text-primary-800">{exp.numero_completo}</span>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      width: 'w-28',
      render: (exp) => (
        <span className="tabular-nums">{formatDate(exp.fechaIngreso)}</span>
      ),
    },
    {
      key: 'detalle',
      header: 'Detalle',
      render: (exp) => (
        <span className="line-clamp-2 text-slate-700">{exp.detalle || '—'}</span>
      ),
    },
    {
      key: 'importe',
      header: 'Importe',
      width: 'w-32',
      align: 'right',
      render: (exp) => (
        <span className="font-medium tabular-nums">{formatCurrency(exp.importe)}</span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: 'w-28',
      render: (exp) => (
        <EstadoExpedienteBadge estado={exp.estado} anulado={exp.anulado} />
      ),
    },
  ];

  const historialColumns: SpreadsheetColumn<AuditoriaRegistro>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      width: 'w-40',
      render: (item) => (
        <span className="tabular-nums text-slate-600">
          {new Date(item.created_at).toLocaleString('es-AR')}
        </span>
      ),
    },
    {
      key: 'accion',
      header: 'Acción',
      width: 'w-32',
      render: (item) => (
        <span
          className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
            ACCION_COLORS[item.accion] ?? 'bg-slate-100 text-slate-700'
          }`}
        >
          {ACCION_LABELS[item.accion] ?? item.accion}
        </span>
      ),
    },
    {
      key: 'usuario',
      header: 'Usuario',
      width: 'w-40',
      render: (item) => item.usuario_nombre ?? item.usuario_username ?? '—',
    },
    {
      key: 'cambios',
      header: 'Cambios',
      render: (item) => (
        <span className="text-slate-600">{formatCambios(item.cambios)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <DetailBackNav listTo="/proveedores" listLabel="Volver a proveedores" />

      {formError && tab === 'datos' && !deleteModal && !deactivateModal && (
        <SpreadsheetFormError>{formError}</SpreadsheetFormError>
      )}

      <SpreadsheetShell
        title={draft.nombre.trim() || proveedor.nombre}
        subtitle={
          draft.documento.trim()
            ? `CUIT / DNI ${draft.documento.trim()}`
            : 'Ficha del proveedor'
        }
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
                  onClick={handleSave}
                >
                  <Check size={14} /> Guardar cambios
                </Button>
              </>
            )}
            {canWrite && draft.activo && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDeactivateModal(true)}
              >
                <Ban size={14} /> Desactivar
              </Button>
            )}
            {canWrite && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  setDeleteError('');
                  setDeleteModal(true);
                }}
              >
                <Trash2 size={14} /> Eliminar
              </Button>
            )}
          </div>
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <StatusBadge
              label={draft.activo ? 'Activo' : 'Inactivo'}
              variant={draft.activo ? 'success' : 'danger'}
            />
            <span className="text-slate-300">|</span>
            <span>
              <strong className="tabular-nums text-slate-800">
                {resumen?.totalExpedientes ?? 0}
              </strong>{' '}
              expediente{(resumen?.totalExpedientes ?? 0) !== 1 ? 's' : ''}
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Total{' '}
              <strong className="tabular-nums text-slate-800">
                {formatCurrency(resumen?.importeTotal ?? 0)}
              </strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Pagado{' '}
              <strong className="tabular-nums text-emerald-700">
                {formatCurrency(resumen?.importePagado ?? 0)}
              </strong>
            </span>
            {resumen && resumen.porEstado.length > 0 && (
              <>
                <span className="text-slate-300">|</span>
                <div className="flex flex-wrap gap-1">
                  {resumen.porEstado.map((item) => (
                    <span
                      key={item.estado}
                      className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-600"
                      title={formatCurrency(item.importe)}
                    >
                      {ESTADO_EXPEDIENTE_LABELS[item.estado] ?? item.estado}{' '}
                      <span className="tabular-nums font-medium text-slate-800">{item.total}</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        }
      >
        <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 px-3 pt-2">
          {TABS.map((t) => {
            const count =
              t.id === 'expedientes'
                ? resumen?.totalExpedientes ?? expedientes.length
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

        {tab === 'expedientes' && (
          <>
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
              {canReadExpedientes
                ? 'Expedientes vinculados a este proveedor · clic en una fila para abrir el detalle'
                : 'No tiene permiso para consultar expedientes'}
            </div>
            {canReadExpedientes ? (
              <SpreadsheetGrid
                columns={expedienteColumns}
                data={expedientes}
                rowKey={(exp) => exp.id}
                loading={loadingExpedientes}
                showRowNumbers
                emptyMessage="Sin expedientes vinculados a este proveedor"
                onRowClick={(exp) =>
                  navigate(`/expedientes/${exp.id}`, {
                    state: buildReturnState(proveedorReturnPath('expedientes')),
                  })
                }
              />
            ) : (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                Solicite el permiso de lectura de expedientes para ver este listado.
              </div>
            )}
          </>
        )}

        {tab === 'historial' && (
          <>
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
              Cambios registrados sobre este proveedor (alta, edición y baja)
            </div>
            <SpreadsheetGrid
              columns={historialColumns}
              data={historial ?? []}
              rowKey={(item) => item.id}
              showRowNumbers
              emptyMessage="Sin movimientos de auditoría para este proveedor"
            />
          </>
        )}
      </SpreadsheetShell>

      <Modal
        open={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Confirmar eliminación"
        size="sm"
      >
        <p className="mb-4 text-sm text-slate-600">
          ¿Está seguro que desea eliminar al proveedor <strong>{proveedor.nombre}</strong>?
          Esta acción no se puede deshacer.
        </p>
        {tieneExpedientes && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              Tiene expedientes vinculados. Si no puede eliminarse, se ofrecerá
              desactivarlo.
            </span>
          </div>
        )}
        {deleteError && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{deleteError}</span>
          </div>
        )}
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

      <Modal
        open={deactivateModal}
        onClose={() => setDeactivateModal(false)}
        title="Desactivar proveedor"
        size="sm"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <AlertTriangle size={20} />
          </div>
          <p className="text-sm leading-relaxed text-slate-600">
            {tieneExpedientes
              ? 'No se puede eliminar porque tiene expedientes vinculados. '
              : ''}
            Al desactivarlo dejará de aparecer en el catálogo activo y no podrá usarse en
            nuevos expedientes, conservando el historial.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeactivateModal(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={deactivateMutation.isPending}
            onClick={() => deactivateMutation.mutate()}
          >
            <Ban size={15} />
            Desactivar
          </Button>
        </div>
      </Modal>

      <Modal
        open={leaveModal}
        onClose={cancelLeave}
        title="Cambios sin guardar"
        size="sm"
      >
        <p className="mb-6 text-sm text-slate-600">
          Tiene modificaciones sin guardar. Si sale ahora, se perderán.
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
    </div>
  );
}
