import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  useParams,
  useNavigate,
  Link,
  useBlocker,
  useSearchParams,
} from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Pencil,
  Trash2,
  Ban,
  Archive,
  Check,
  X,
  FileSearch,
} from 'lucide-react';
import {
  getExpediente,
  getExpedienteHistorial,
  updateExpediente,
  deleteExpediente,
  anularExpediente,
  archivarExpediente,
} from '@/services/expedientes.service';
import { getAfectaciones } from '@/services/afectaciones.service';
import { getLibramientos } from '@/services/libramientos.service';
import { getPagos } from '@/services/pagos.service';
import { getAnticipos } from '@/services/anticipos.service';
import { getLibramientosAnticipo } from '@/services/libramientosAnticipo.service';
import { NuevoAnticipoModal } from '@/components/anticipos/NuevoAnticipoModal';
import { NuevoLibramientoAnticipoModal } from '@/components/libramientos/NuevoLibramientoAnticipoModal';
import { EstadoExpedienteBadge } from '@/components/expedientes/EstadoExpedienteBadge';
import { ProveedorMultiCombobox } from '@/components/expedientes/ProveedorMultiCombobox';
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
import { Alert } from '@/components/ui/Alert';
import { useAuthStore } from '@/stores/authStore';
import {
  formatCurrency,
  formatDate,
  toImporteInput,
  parseImporteAR,
  labelEstadoExpediente,
  labelTramiteExpediente,
} from '@/utils/format';
import { ImporteInput } from '@/components/ui/ImporteInput';
import { buildReturnState } from '@/utils/navigationReturn';
import { ApiClientError } from '@/services/api';
import type {
  Afectacion,
  Anticipo,
  CircuitoExpediente,
  ExpedienteHistorial,
  Libramiento,
  LibramientoAnticipo,
  Pago,
  Proveedor,
} from '@/types';
import { getProveedor } from '@/services/proveedores.service';
import { MEDIO_PAGO_LABELS } from '@/services/pagos.service';
import { formatProveedoresNombres } from '@/utils/proveedores';

type TabId = 'datos' | 'afectaciones' | 'anticipos' | 'libramientos' | 'pagos' | 'historial';
type EditableField = 'fechaIngreso' | 'proveedor' | 'importe' | 'detalle';

interface DraftState {
  fechaIngreso: string;
  proveedores: Proveedor[];
  importe: string;
  detalle: string;
  circuito: CircuitoExpediente;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'datos', label: 'Datos' },
  { id: 'afectaciones', label: 'Afectaciones' },
  { id: 'libramientos', label: 'Libramientos' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'historial', label: 'Historial' },
];

function parseTab(value: string | null): TabId {
  if (
    value === 'afectaciones' ||
    value === 'anticipos' ||
    value === 'libramientos' ||
    value === 'pagos' ||
    value === 'historial' ||
    value === 'datos'
  ) {
    return value;
  }
  return 'datos';
}

function draftFromExpediente(exp: {
  fechaIngreso: string;
  proveedor_id: number;
  proveedor_nombre?: string;
  proveedores?: Array<{ id: number; nombre: string; documento?: string | null }>;
  importe: number;
  detalle: string;
  circuito?: CircuitoExpediente;
}): DraftState {
  const list =
    exp.proveedores && exp.proveedores.length > 0
      ? exp.proveedores.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          documento: p.documento ?? null,
          domicilio: null,
          telefono: null,
          activo: true,
          created_at: '',
          updated_at: '',
        }))
      : [
          {
            id: exp.proveedor_id,
            nombre: exp.proveedor_nombre ?? '',
            documento: null,
            domicilio: null,
            telefono: null,
            activo: true,
            created_at: '',
            updated_at: '',
          },
        ];

  return {
    fechaIngreso: exp.fechaIngreso,
    proveedores: list,
    importe: toImporteInput(Number(exp.importe)),
    detalle: exp.detalle,
    circuito:
      exp.circuito === 'CARGO_A_RENDIR'
        ? 'CARGO_A_RENDIR'
        : exp.circuito === 'NORMAL'
          ? 'NORMAL'
          : 'PENDIENTE',
  };
}

export function ExpedienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission('expedientes:write'));

  const expedienteId = Number(id);

  const [tab, setTab] = useState<TabId>(() => parseTab(searchParams.get('tab')));
  const [anularModal, setAnularModal] = useState(false);
  const [archivarModal, setArchivarModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [leaveModal, setLeaveModal] = useState(false);
  const [anticipoModal, setAnticipoModal] = useState(false);
  const [libAnticipoModal, setLibAnticipoModal] = useState(false);
  const [formError, setFormError] = useState('');
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [observacionArchivo, setObservacionArchivo] = useState('');

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [editingFields, setEditingFields] = useState<Set<EditableField>>(new Set());
  const [baselineKey, setBaselineKey] = useState('');

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

  const listPath = '/expedientes';
  const listLabel = 'Volver a expedientes';

  const expedienteReturnPath = (tabId: TabId) => {
    const base = `/expedientes/${expedienteId}`;
    return tabId === 'datos' ? base : `${base}?tab=${tabId}`;
  };

  const { data: expediente, isLoading, error } = useQuery({
    queryKey: ['expediente', expedienteId],
    queryFn: () => getExpediente(expedienteId),
    enabled: !isNaN(expedienteId),
  });

  const isCargo = expediente?.circuito === 'CARGO_A_RENDIR';
  const isPendiente = (expediente?.circuito ?? 'PENDIENTE') === 'PENDIENTE';
  const isAfectacion = expediente?.circuito === 'NORMAL';

  useEffect(() => {
    if (!expediente) return;
    if (isPendiente && (tab === 'afectaciones' || tab === 'anticipos' || tab === 'pagos' || tab === 'libramientos')) {
      selectTab('datos');
    } else if (isCargo && (tab === 'afectaciones' || tab === 'pagos')) {
      selectTab(tab === 'afectaciones' ? 'anticipos' : 'datos');
    } else if (isAfectacion && tab === 'anticipos') {
      selectTab('afectaciones');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expediente?.circuito, tab]);

  const { data: historial } = useQuery({
    queryKey: ['expediente-historial', expedienteId],
    queryFn: () => getExpedienteHistorial(expedienteId),
    enabled: !isNaN(expedienteId),
  });

  const { data: afectacionesExp } = useQuery({
    queryKey: ['afectaciones', 'por-expediente', expedienteId],
    queryFn: () =>
      getAfectaciones({ expedienteId, limit: 100, sortBy: 'fecha', sortOrder: 'desc' }),
    enabled: !isNaN(expedienteId) && expediente != null && isAfectacion,
  });

  const { data: libramientosExp } = useQuery({
    queryKey: ['libramientos', 'por-expediente', expedienteId],
    queryFn: () =>
      getLibramientos({ expedienteId, limit: 100, sortBy: 'fecha', sortOrder: 'desc' }),
    enabled: !isNaN(expedienteId) && expediente != null && isAfectacion,
  });

  const { data: pagosExp } = useQuery({
    queryKey: ['pagos', 'por-expediente', expedienteId],
    queryFn: () =>
      getPagos({ expedienteId, limit: 100, sortBy: 'fecha_pago', sortOrder: 'desc' }),
    enabled: !isNaN(expedienteId) && expediente != null && isAfectacion,
  });

  const { data: anticiposExp } = useQuery({
    queryKey: ['anticipos', 'por-expediente', expedienteId],
    queryFn: () =>
      getAnticipos({ expedienteId, limit: 100, sortBy: 'fecha', sortOrder: 'desc' }),
    enabled: !isNaN(expedienteId) && isCargo,
  });

  const { data: libramientosAnticipoExp } = useQuery({
    queryKey: ['libramientos-anticipo', 'por-expediente', expedienteId],
    queryFn: () =>
      getLibramientosAnticipo({ expedienteId, limit: 100, sortBy: 'fecha', sortOrder: 'desc' }),
    enabled: !isNaN(expedienteId) && isCargo,
  });

  useEffect(() => {
    if (!expediente) return;
    const key = `${expediente.id}-${expediente.updated_at}`;
    if (key === baselineKey) return;
    setDraft(draftFromExpediente(expediente));
    setEditingFields(new Set());
    setFormError('');
    setBaselineKey(key);
  }, [expediente, baselineKey]);

  useEffect(() => {
    if (!draft || draft.proveedores.length === 0) return;
    const needsHydrate = draft.proveedores.some((p) => !p.documento && !p.domicilio && !p.telefono);
    if (!needsHydrate) return;
    let cancelled = false;
    Promise.all(draft.proveedores.map((p) => getProveedor(p.id).catch(() => p))).then((list) => {
      if (cancelled) return;
      setDraft((prev) => (prev ? { ...prev, proveedores: list } : prev));
    });
    return () => {
      cancelled = true;
    };
    // Solo hidratar al cargar el draft inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baselineKey]);

  const isDirty = useMemo(() => {
    if (!expediente || !draft) return false;
    const importeNum = parseImporteAR(draft.importe);
    const originalImporte = Number(expediente.importe);
    const originalIds = (expediente.proveedores?.map((p) => p.id) ?? [expediente.proveedor_id]).join(',');
    const draftIds = draft.proveedores.map((p) => p.id).join(',');
    return (
      draft.fechaIngreso !== expediente.fechaIngreso ||
      draftIds !== originalIds ||
      draft.detalle.trim() !== expediente.detalle.trim() ||
      draft.circuito !== (expediente.circuito ?? 'PENDIENTE') ||
      (!Number.isNaN(importeNum) && Math.abs(importeNum - originalImporte) > 0.001)
    );
  }, [expediente, draft]);

  const blocker = useBlocker(isDirty);

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setLeaveModal(true);
    }
  }, [blocker.state]);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['expediente', expedienteId] });
    queryClient.invalidateQueries({ queryKey: ['expediente-historial', expedienteId] });
    queryClient.invalidateQueries({ queryKey: ['afectaciones', 'por-expediente', expedienteId] });
    queryClient.invalidateQueries({ queryKey: ['libramientos', 'por-expediente', expedienteId] });
    queryClient.invalidateQueries({ queryKey: ['pagos', 'por-expediente', expedienteId] });
    queryClient.invalidateQueries({ queryKey: ['anticipos', 'por-expediente', expedienteId] });
    queryClient.invalidateQueries({ queryKey: ['libramientos-anticipo', 'por-expediente', expedienteId] });
    queryClient.invalidateQueries({ queryKey: ['expedientes'] });
    queryClient.invalidateQueries({ queryKey: ['expedientes-resumen'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  };

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error('Sin datos');
      const importe = parseImporteAR(draft.importe);
      if (Number.isNaN(importe) || importe <= 0) {
        throw new ApiClientError('El importe debe ser mayor a cero', 400, 'INVALID_IMPORTE');
      }
      return updateExpediente(expedienteId, {
        proveedorIds: draft.proveedores.map((p) => p.id),
        importe,
        detalle: draft.detalle.trim(),
        fechaIngreso: draft.fechaIngreso,
        circuito: draft.circuito,
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
    mutationFn: () => deleteExpediente(expedienteId),
    onSuccess: () => navigate(listPath),
  });

  const anularMutation = useMutation({
    mutationFn: () => anularExpediente(expedienteId, motivoAnulacion),
    onSuccess: () => {
      invalidate();
      setAnularModal(false);
      setMotivoAnulacion('');
    },
    onError: (err) =>
      setFormError(err instanceof ApiClientError ? err.message : 'Error al anular'),
  });

  const archivarMutation = useMutation({
    mutationFn: () => archivarExpediente(expedienteId, observacionArchivo || undefined),
    onSuccess: () => {
      invalidate();
      setArchivarModal(false);
      setObservacionArchivo('');
    },
    onError: (err) =>
      setFormError(err instanceof ApiClientError ? err.message : 'Error al archivar'),
  });

  if (isLoading || !draft) {
    return <div className="py-12 text-center text-sm text-slate-500">Cargando expediente...</div>;
  }

  if (error || !expediente) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-sm text-slate-500">Expediente no encontrado</p>
        <Link to={listPath} className="text-sm text-primary-600 hover:underline">
          Volver al listado
        </Link>
      </div>
    );
  }

  const puedeEditar = canWrite && expediente.estado === 'INICIADO' && !expediente.anulado;
  const puedeEliminar = puedeEditar;
  const puedeAnular = puedeEditar;
  const puedeArchivar =
    canWrite &&
    !expediente.anulado &&
    (expediente.estado === 'INICIADO' || expediente.estado === 'PAGADO');

  const startEdit = (field: EditableField) => {
    if (!puedeEditar) return;
    setEditingFields((prev) => new Set(prev).add(field));
  };

  const stopEdit = (field: EditableField) => {
    setEditingFields((prev) => {
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  };

  const discardChanges = () => {
    setDraft(draftFromExpediente(expediente));
    setEditingFields(new Set());
    setFormError('');
  };

  const handleSave = () => {
    const importe = parseImporteAR(draft.importe);
    if (!draft.fechaIngreso || !draft.detalle.trim() || Number.isNaN(importe) || importe <= 0) {
      setFormError('Complete fecha, proveedores, importe y detalle correctamente');
      return;
    }
    if (draft.proveedores.length === 0) {
      setFormError('Seleccione al menos un proveedor');
      return;
    }
    setFormError('');
    updateMutation.mutate();
  };

  const confirmLeave = () => {
    setLeaveModal(false);
    if (blocker.state === 'blocked') {
      blocker.proceed();
      return;
    }
    discardChanges();
    navigate(listPath);
  };

  const cancelLeave = () => {
    setLeaveModal(false);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  };

  const afectacionesList = afectacionesExp?.data ?? [];
  const afectacionesActivas = afectacionesList.filter((a) => !a.anulada);
  const importeAfectado = afectacionesActivas.reduce((s, a) => s + Number(a.importe_total), 0);
  const anticiposList = anticiposExp?.data ?? [];
  const anticiposActivos = anticiposList.filter((a) => !a.anulada);
  const importeAnticipado = anticiposActivos.reduce((s, a) => s + Number(a.importe), 0);
  const importeComprometido = isCargo ? importeAnticipado : importeAfectado;
  const importeDisponible = Math.max(0, Number(expediente.importe) - importeComprometido);
  const libramientosList = libramientosExp?.data ?? [];
  const libramientosAnticipoList = libramientosAnticipoExp?.data ?? [];
  const pagosList = pagosExp?.data ?? [];
  const visibleTabs: { id: TabId; label: string }[] = isPendiente
    ? [
        { id: 'datos', label: 'Datos' },
        { id: 'historial', label: 'Historial' },
      ]
    : isCargo
      ? [
          { id: 'datos', label: 'Datos' },
          { id: 'anticipos', label: 'Anticipos' },
          { id: 'libramientos', label: 'Libramientos' },
          { id: 'historial', label: 'Historial' },
        ]
      : TABS;
  const puedeCambiarCircuito =
    puedeEditar &&
    (expediente.afectaciones_activas ?? 0) === 0 &&
    (expediente.anticipos_activos ?? 0) === 0 &&
    afectacionesActivas.length === 0 &&
    anticiposActivos.length === 0;

  const historialColumns: SpreadsheetColumn<ExpedienteHistorial>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      width: 'w-36',
      render: (item) => (
        <span className="tabular-nums">{new Date(item.created_at).toLocaleString('es-AR')}</span>
      ),
    },
    {
      key: 'accion',
      header: 'Acción',
      width: 'w-32',
      render: (item) => <span className="font-medium">{item.accion}</span>,
    },
    {
      key: 'estado',
      header: 'Cambio de estado',
      width: 'w-44',
      render: (item) =>
        item.estado_anterior && item.estado_nuevo && item.estado_anterior !== item.estado_nuevo ? (
          <span className="text-slate-600">
            {labelEstadoExpediente(item.estado_anterior, expediente.circuito)} →{' '}
            {labelEstadoExpediente(item.estado_nuevo, expediente.circuito)}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'usuario',
      header: 'Usuario',
      width: 'w-36',
      render: (item) => item.usuario_nombre ?? '—',
    },
    {
      key: 'observacion',
      header: 'Observación',
      render: (item) => item.observacion ?? '—',
    },
  ];

  const afectacionColumns: SpreadsheetColumn<Afectacion>[] = [
    {
      key: 'numero',
      header: 'Número',
      width: 'w-28',
      render: (af) => (
        <span className="font-mono font-semibold text-primary-800">{af.numero_completo}</span>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      width: 'w-24',
      render: (af) => <span className="tabular-nums">{formatDate(af.fecha)}</span>,
    },
    {
      key: 'destinatario',
      header: 'Destinatario',
      render: (af) => af.destinatario,
    },
    {
      key: 'importe',
      header: 'Importe',
      width: 'w-32',
      align: 'right',
      render: (af) => (
        <span className="font-medium tabular-nums">{formatCurrency(af.importe_total)}</span>
      ),
    },
    {
      key: 'comprobante',
      header: 'Comprobante',
      width: 'w-28',
      render: (af) =>
        af.numero_comprobante ? (
          <span className="font-mono text-slate-600">{af.numero_comprobante}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'observaciones',
      header: 'Observaciones',
      render: (af) => af.observaciones || <span className="text-slate-400">—</span>,
    },
    {
      key: 'estado',
      header: 'Estado',
      width: 'w-24',
      render: (af) =>
        af.anulada ? (
          <StatusBadge label="Anulada" variant="danger" />
        ) : (
          <StatusBadge label="Activa" variant="success" />
        ),
    },
  ];

  const anticipoColumns: SpreadsheetColumn<Anticipo>[] = [
    {
      key: 'numero',
      header: 'Número',
      width: 'w-28',
      render: (af) => (
        <span className="font-mono font-semibold text-primary-800">{af.numero_completo}</span>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      width: 'w-24',
      render: (af) => <span className="tabular-nums">{formatDate(af.fecha)}</span>,
    },
    {
      key: 'destinatario',
      header: 'Destinatario',
      render: (af) => af.destinatario,
    },
    {
      key: 'importe',
      header: 'Importe',
      width: 'w-32',
      align: 'right',
      render: (af) => (
        <span className="font-medium tabular-nums">{formatCurrency(af.importe)}</span>
      ),
    },
    {
      key: 'comprobante',
      header: 'Comprobante',
      width: 'w-28',
      render: (af) =>
        af.numero_comprobante ? (
          <span className="font-mono text-slate-600">{af.numero_comprobante}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
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

  const libramientoAnticipoColumns: SpreadsheetColumn<LibramientoAnticipo>[] = [
    {
      key: 'numero',
      header: 'Número',
      width: 'w-28',
      render: (lib) => (
        <span className="font-mono font-semibold text-primary-800">{lib.numero_completo}</span>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      width: 'w-24',
      render: (lib) => <span className="tabular-nums">{formatDate(lib.fecha)}</span>,
    },
    {
      key: 'beneficiario',
      header: 'Beneficiario',
      render: (lib) => lib.beneficiario,
    },
    {
      key: 'importe',
      header: 'Importe',
      width: 'w-32',
      align: 'right',
      render: (lib) => (
        <span className="font-medium tabular-nums">{formatCurrency(lib.importe)}</span>
      ),
    },
    {
      key: 'neto',
      header: 'Neto',
      width: 'w-32',
      align: 'right',
      render: (lib) => (
        <span className="font-medium tabular-nums text-emerald-700">{formatCurrency(lib.neto)}</span>
      ),
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

  const libramientoColumns: SpreadsheetColumn<Libramiento>[] = [
    {
      key: 'numero',
      header: 'Número',
      width: 'w-28',
      render: (lib) => (
        <span className="font-mono font-semibold text-primary-800">{lib.numero_completo}</span>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      width: 'w-24',
      render: (lib) => <span className="tabular-nums">{formatDate(lib.fecha)}</span>,
    },
    {
      key: 'beneficiario',
      header: 'Beneficiario',
      render: (lib) => lib.beneficiario,
    },
    {
      key: 'importe',
      header: 'Importe',
      width: 'w-32',
      align: 'right',
      render: (lib) => (
        <span className="font-medium tabular-nums">{formatCurrency(lib.importe)}</span>
      ),
    },
    {
      key: 'neto',
      header: 'Neto',
      width: 'w-32',
      align: 'right',
      render: (lib) => (
        <span className="font-medium tabular-nums text-emerald-700">{formatCurrency(lib.neto)}</span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: 'w-24',
      render: (lib) => {
        if (lib.anulado) return <StatusBadge label="Anulado" variant="danger" />;
        if (lib.pagado) return <StatusBadge label="Pagado" variant="info" />;
        if (Number(lib.monto_pagado ?? 0) > 0.01) {
          return <StatusBadge label="Pago parcial" variant="warning" />;
        }
        return <StatusBadge label="Activo" variant="success" />;
      },
    },
  ];

  const pagoColumns: SpreadsheetColumn<Pago>[] = [
    {
      key: 'numero',
      header: 'Número',
      width: 'w-28',
      render: (pago) => (
        <span className="font-mono font-semibold text-primary-800">{pago.numero_completo}</span>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha pago',
      width: 'w-28',
      render: (pago) => <span className="tabular-nums">{formatDate(pago.fecha_pago)}</span>,
    },
    {
      key: 'beneficiario',
      header: 'Beneficiario',
      render: (pago) => pago.beneficiario,
    },
    {
      key: 'monto',
      header: 'Monto',
      width: 'w-32',
      align: 'right',
      render: (pago) => (
        <span className="font-medium tabular-nums">{formatCurrency(pago.monto)}</span>
      ),
    },
    {
      key: 'medio',
      header: 'Medio',
      width: 'w-32',
      render: (pago) => (
        <span className="text-slate-600">{MEDIO_PAGO_LABELS[pago.medio_pago]}</span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: 'w-24',
      render: (pago) =>
        pago.anulado ? (
          <StatusBadge label="Anulado" variant="danger" />
        ) : (
          <StatusBadge label="Pagado" variant="success" />
        ),
    },
  ];

  const flujoEstados = ['INICIADO', 'AFECTADO', 'LIBRADO', 'PAGADO', 'ARCHIVADO'] as const;

  const proveedoresLabel =
    formatProveedoresNombres(draft.proveedores) ||
    expediente.proveedor_nombre ||
    '—';

  const renderEditableCell = (
    field: EditableField,
    display: ReactNode,
    editor: ReactNode,
    alignTop = false
  ) => {
    const isEditing = editingFields.has(field);
    const canStartEdit = puedeEditar && !isEditing;

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
        {puedeEditar && (
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
      label: 'Número',
      value: <span className="font-mono font-semibold">{expediente.numero_completo}</span>,
    },
    {
      label: 'Año',
      value: <span className="tabular-nums">{expediente.anio}</span>,
    },
    {
      label: 'Trámite',
      value: puedeCambiarCircuito ? (
        <div className="flex flex-col gap-1.5 py-0.5">
          <select
            value={draft.circuito}
            onChange={(e) =>
              setDraft({ ...draft, circuito: e.target.value as CircuitoExpediente })
            }
            className={cellInput}
          >
            <option value="PENDIENTE">Sin definir</option>
            <option value="NORMAL">Afectación</option>
            <option value="CARGO_A_RENDIR">Anticipo</option>
          </select>
          {draft.circuito === 'PENDIENTE' && (
            <p className="px-1 text-[11px] text-slate-500">
              El expediente es único. Acá se indica si continúa con afectación o con anticipo.
              Guarde el cambio para habilitar el trámite.
            </p>
          )}
        </div>
      ) : (
        <span>{labelTramiteExpediente(draft.circuito)}</span>
      ),
    },
    {
      label: 'Fecha ingreso',
      value: renderEditableCell(
        'fechaIngreso',
        <span className="tabular-nums">{formatDate(draft.fechaIngreso)}</span>,
        <input
          type="date"
          value={draft.fechaIngreso}
          onChange={(e) => setDraft({ ...draft, fechaIngreso: e.target.value })}
          className={cellInput}
          autoFocus
        />
      ),
    },
    {
      label: 'Proveedores',
      value: renderEditableCell(
        'proveedor',
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          {draft.proveedores.map((p) => (
            <Link
              key={p.id}
              to={`/proveedores/${p.id}`}
              className="font-medium text-primary-800 hover:underline"
              onClick={(e) => e.stopPropagation()}
              state={buildReturnState(expedienteReturnPath('datos'))}
            >
              {p.nombre}
            </Link>
          ))}
          {draft.proveedores.length === 0 && (
            <span>{expediente.proveedor_nombre || '—'}</span>
          )}
        </div>,
        <div className="py-0.5">
          <ProveedorMultiCombobox
            value={draft.proveedores}
            onChange={(list) => setDraft({ ...draft, proveedores: list })}
            variant="cell"
          />
        </div>,
        true
      ),
    },
    {
      label: 'Importe',
      value: renderEditableCell(
        'importe',
        <span className="font-semibold tabular-nums">
          {formatCurrency(parseImporteAR(draft.importe) || 0)}
        </span>,
        <ImporteInput
          value={draft.importe}
          onChange={(importe) => setDraft({ ...draft, importe })}
          className={cellInput}
          autoFocus
        />
      ),
    },
    {
      label: isCargo ? 'Anticipado' : 'Afectado',
      value: (
        <span className="font-medium tabular-nums text-amber-700">
          {formatCurrency(importeComprometido)}
        </span>
      ),
    },
    {
      label: 'Disponible',
      value: (
        <span className="font-semibold tabular-nums text-emerald-700">
          {formatCurrency(importeDisponible)}
        </span>
      ),
    },
    {
      label: 'Detalle',
      value: renderEditableCell(
        'detalle',
        <span className="whitespace-pre-wrap">{draft.detalle}</span>,
        <textarea
          value={draft.detalle}
          onChange={(e) => setDraft({ ...draft, detalle: e.target.value })}
          rows={4}
          className="w-full min-w-0 resize-none rounded-none border-0 bg-transparent px-2 py-1.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500/40"
          autoFocus
        />,
        true
      ),
    },
    {
      label: 'Estado',
      value: (
        <EstadoExpedienteBadge
          estado={expediente.estado}
          anulado={expediente.anulado}
          circuito={expediente.circuito}
        />
      ),
    },
    ...(expediente.anulado && expediente.motivo_anulacion
      ? [
          {
            label: 'Motivo anulación',
            value: <span className="text-red-700">{expediente.motivo_anulacion}</span>,
          },
        ]
      : []),
    ...(expediente.usuario_creacion_nombre
      ? [{ label: 'Creado por', value: <>{expediente.usuario_creacion_nombre}</> }]
      : []),
    {
      label: 'Registrado',
      value: (
        <span className="tabular-nums">
          {new Date(expediente.created_at).toLocaleString('es-AR')}
        </span>
      ),
    },
    {
      label: 'Actualizado',
      value: (
        <span className="tabular-nums">
          {new Date(expediente.updated_at).toLocaleString('es-AR')}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <DetailBackNav listTo={listPath} listLabel={listLabel} />

      {formError && tab === 'datos' && !anularModal && (
        <SpreadsheetFormError>{formError}</SpreadsheetFormError>
      )}

      <SpreadsheetShell
        title={expediente.numero_completo}
        subtitle={proveedoresLabel}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isAfectacion && (
            <Link
              to={`/consultas?tab=trazabilidad&expediente=${expediente.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary-300 bg-white px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50"
            >
              <FileSearch size={14} />
              Ver trazabilidad
            </Link>
            )}
            {isDirty && (
              <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                Cambios sin guardar
              </span>
            )}
            {puedeEditar && isDirty && (
              <>
                <Button type="button" variant="secondary" size="sm" onClick={discardChanges}>
                  <X size={14} /> Descartar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="!bg-emerald-600 hover:!bg-emerald-700"
                  loading={updateMutation.isPending}
                  onClick={handleSave}
                >
                  <Check size={14} /> Guardar cambios
                </Button>
              </>
            )}
            {puedeArchivar && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setArchivarModal(true)}
              >
                <Archive size={14} /> Archivar
              </Button>
            )}
            {puedeAnular && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFormError('');
                  setAnularModal(true);
                }}
              >
                <Ban size={14} /> Anular
              </Button>
            )}
            {puedeEliminar && (
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
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <EstadoExpedienteBadge
              estado={expediente.estado}
              anulado={expediente.anulado}
              circuito={expediente.circuito}
            />
            <span className="text-slate-400">|</span>
            {flujoEstados.map((est, i) => {
              const isCurrent = expediente.estado === est && !expediente.anulado;
              const isPast = flujoEstados.indexOf(expediente.estado) > i;
              return (
                <span key={est} className="flex items-center gap-1">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${
                      isCurrent
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : isPast
                          ? 'border-primary-200 bg-primary-50 text-primary-800'
                          : 'border-slate-200 bg-white text-slate-400'
                    }`}
                  >
                    {labelEstadoExpediente(est, expediente.circuito)}
                  </span>
                  {i < flujoEstados.length - 1 && <span className="text-slate-300">›</span>}
                </span>
              );
            })}
          </div>
        }
      >
        <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 px-3 pt-2">
          {visibleTabs.map((t) => {
            const count =
              t.id === 'afectaciones'
                ? afectacionesList.length
                : t.id === 'anticipos'
                  ? anticiposList.length
                  : t.id === 'libramientos'
                    ? isCargo
                      ? libramientosAnticipoList.length
                      : libramientosList.length
                    : t.id === 'pagos'
                      ? pagosList.length
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
          <>
            {isPendiente && !expediente.anulado && (
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                Indique el trámite de este expediente (afectación o anticipo) y guarde los cambios.
                Hasta entonces no se emiten documentos.
              </div>
            )}
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
          </>
        )}

        {tab === 'afectaciones' && isAfectacion && (
          <>
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
              Compromisos presupuestarios del expediente · {afectacionesActivas.length} activa
              {afectacionesActivas.length !== 1 ? 's' : ''} · Afectado{' '}
              {formatCurrency(importeAfectado)} / {formatCurrency(Number(expediente.importe))} ·
              Disponible {formatCurrency(importeDisponible)}
            </div>
            <SpreadsheetGrid
              columns={afectacionColumns}
              data={afectacionesList}
              rowKey={(af) => af.id}
              showRowNumbers
              emptyMessage="Sin afectaciones registradas para este expediente"
              onRowClick={(af) =>
                navigate(`/afectaciones/${af.id}`, {
                  state: buildReturnState(expedienteReturnPath('afectaciones')),
                })
              }
            />
          </>
        )}

        {tab === 'anticipos' && isCargo && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
              <span>
                Anticipos del expediente · {anticiposActivos.length} activo
                {anticiposActivos.length !== 1 ? 's' : ''} · Anticipado{' '}
                {formatCurrency(importeAnticipado)} / {formatCurrency(Number(expediente.importe))} ·
                Disponible {formatCurrency(importeDisponible)}
              </span>
              {canWrite && expediente.estado !== 'ARCHIVADO' && !expediente.anulado && (
                <button
                  type="button"
                  onClick={() => setAnticipoModal(true)}
                  className="rounded-md bg-primary-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-700"
                >
                  Registrar anticipo
                </button>
              )}
            </div>
            <SpreadsheetGrid
              columns={anticipoColumns}
              data={anticiposList}
              rowKey={(af) => af.id}
              showRowNumbers
              emptyMessage="Sin anticipos registrados para este expediente"
              onRowClick={(af) =>
                navigate(`/anticipos/${af.id}`, {
                  state: buildReturnState(expedienteReturnPath('anticipos')),
                })
              }
            />
          </>
        )}

        {tab === 'libramientos' && isCargo && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
              <span>Libramientos emitidos a partir de los anticipos de este expediente</span>
              {canWrite && expediente.estado === 'AFECTADO' && !expediente.anulado && (
                <button
                  type="button"
                  onClick={() => setLibAnticipoModal(true)}
                  className="rounded-md bg-primary-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-700"
                >
                  Emitir libramiento
                </button>
              )}
            </div>
            <SpreadsheetGrid
              columns={libramientoAnticipoColumns}
              data={libramientosAnticipoList}
              rowKey={(lib) => lib.id}
              showRowNumbers
              emptyMessage="Sin libramientos de anticipo para este expediente"
              onRowClick={(lib) =>
                navigate(`/libramientos-anticipo/${lib.id}`, {
                  state: buildReturnState(expedienteReturnPath('libramientos')),
                })
              }
            />
          </>
        )}

        {tab === 'libramientos' && isAfectacion && (
          <>
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
              Órdenes de pago emitidas a partir de las afectaciones de este expediente
            </div>
            <SpreadsheetGrid
              columns={libramientoColumns}
              data={libramientosList}
              rowKey={(lib) => lib.id}
              showRowNumbers
              emptyMessage="Sin libramientos vinculados a este expediente"
              onRowClick={(lib) =>
                navigate(`/libramientos/${lib.id}`, {
                  state: buildReturnState(expedienteReturnPath('libramientos')),
                })
              }
            />
          </>
        )}

        {tab === 'pagos' && isAfectacion && (
          <>
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
              Pagos registrados sobre libramientos de este expediente
            </div>
            <SpreadsheetGrid
              columns={pagoColumns}
              data={pagosList}
              rowKey={(pago) => pago.id}
              showRowNumbers
              emptyMessage="Sin pagos registrados para este expediente"
              onRowClick={(pago) =>
                navigate(`/pagos/${pago.id}`, {
                  state: buildReturnState(expedienteReturnPath('pagos')),
                })
              }
            />
          </>
        )}

        {tab === 'historial' && (
          <SpreadsheetGrid
            columns={historialColumns}
            data={historial ?? []}
            rowKey={(item) => item.id}
            showRowNumbers
            emptyMessage="Sin movimientos registrados"
          />
        )}
      </SpreadsheetShell>

      <Modal open={leaveModal} onClose={cancelLeave} title="Cambios sin guardar" size="sm">
        <p className="mb-6 text-sm text-slate-600">
          Tiene cambios sin guardar en el expediente. Si sale ahora, se perderán.
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

      <Modal open={anularModal} onClose={() => setAnularModal(false)} title="Anular expediente" size="sm">
        {formError && (
          <div className="mb-4">
            <Alert type="error">{formError}</Alert>
          </div>
        )}
        <p className="mb-4 text-sm text-slate-600">
          La anulación conserva el historial. Indique el motivo:
        </p>
        <textarea
          value={motivoAnulacion}
          onChange={(e) => setMotivoAnulacion(e.target.value)}
          rows={3}
          className="mb-4 w-full rounded-none border border-border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          placeholder="Motivo de la anulación (mínimo 5 caracteres)"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setAnularModal(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={anularMutation.isPending}
            onClick={() => anularMutation.mutate()}
            disabled={motivoAnulacion.length < 5}
          >
            Confirmar anulación
          </Button>
        </div>
      </Modal>

      <Modal open={archivarModal} onClose={() => setArchivarModal(false)} title="Archivar expediente" size="sm">
        <p className="mb-4 text-sm text-slate-600">
          {expediente.estado === 'PAGADO'
            ? 'El expediente completó su ciclo de pago y pasará a estado Archivado.'
            : 'El expediente pasará a estado Archivado sin procesar afectaciones.'}
        </p>
        <textarea
          value={observacionArchivo}
          onChange={(e) => setObservacionArchivo(e.target.value)}
          rows={2}
          className="mb-4 w-full rounded-none border border-border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          placeholder="Observación (opcional)"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setArchivarModal(false)}>
            Cancelar
          </Button>
          <Button loading={archivarMutation.isPending} onClick={() => archivarMutation.mutate()}>
            Archivar
          </Button>
        </div>
      </Modal>

      <Modal open={deleteModal} onClose={() => setDeleteModal(false)} title="Eliminar expediente" size="sm">
        <p className="mb-6 text-sm text-slate-600">
          ¿Eliminar el expediente <strong>{expediente.numero_completo}</strong>? Esta acción es
          reversible en base de datos (soft delete).
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

      {isCargo && (
        <>
          <NuevoAnticipoModal
            open={anticipoModal}
            onClose={() => setAnticipoModal(false)}
            expedienteId={expedienteId}
          />
          <NuevoLibramientoAnticipoModal
            open={libAnticipoModal}
            onClose={() => setLibAnticipoModal(false)}
          />
        </>
      )}
    </div>
  );
}
