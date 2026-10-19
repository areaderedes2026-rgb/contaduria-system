import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, Link, useBlocker } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  Calendar,
  Check,
  Download,
  ExternalLink,
  FolderOpen,
  Pencil,
  Plus,
  Printer,
  Receipt,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  getAfectacion,
  updateAfectacion,
  anularAfectacion,
  getCuentasDisponibles,
  getSiguienteNumeroAfectacion,
} from '@/services/afectaciones.service';
import { getExpediente } from '@/services/expedientes.service';
import { getLibramientos } from '@/services/libramientos.service';
import {
  SpreadsheetShell,
  SpreadsheetSection,
  SpreadsheetGrid,
  SpreadsheetFormError,
  SpreadsheetPropertyGrid,
  StatusBadge,
  spreadsheet,
  cellInput,
  cellSelect,
  type SpreadsheetColumn,
} from '@/components/spreadsheet';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { DetailBackNav } from '@/components/layout/DetailBackNav';
import { Alert } from '@/components/ui/Alert';
import { useAuthStore } from '@/stores/authStore';
import {
  formatAfectacionNumero,
  formatCurrency,
  formatDate,
  toImporteInput,
  parseImporteAR,
} from '@/utils/format';
import { importeEnLetras } from '@/utils/importeEnLetras';
import { ImporteInput } from '@/components/ui/ImporteInput';
import { usePrintAfectacion } from '@/hooks/usePrintAfectacion';
import { buildReturnState } from '@/utils/navigationReturn';
import { ApiClientError } from '@/services/api';
import type { AfectacionDetalle } from '@/types';

type EditableField =
  | 'numero'
  | 'fecha'
  | 'destinatario'
  | 'numero_comprobante'
  | 'observaciones'
  | 'detalle';

interface DetalleDraft {
  key: string;
  cuenta_id: string;
  cuenta_codigo: string;
  cuenta_descripcion: string;
  descripcion: string;
  importe: string;
}

interface DraftState {
  numero: string;
  fecha: string;
  destinatario: string;
  numeroComprobante: string;
  observaciones: string;
  detalle: DetalleDraft[];
}

function draftFromAfectacion(af: {
  numero: number;
  fecha: string;
  destinatario: string;
  numero_comprobante?: string | null;
  observaciones?: string | null;
  detalle?: AfectacionDetalle[];
}): DraftState {
  return {
    numero: String(af.numero),
    fecha: af.fecha,
    destinatario: af.destinatario,
    numeroComprobante: af.numero_comprobante ?? '',
    observaciones: af.observaciones ?? '',
    detalle: (af.detalle ?? []).map((d) => ({
      key: `existing-${d.id}`,
      cuenta_id: String(d.cuenta_id),
      cuenta_codigo: d.cuenta_codigo ?? '',
      cuenta_descripcion: d.cuenta_descripcion ?? '',
      descripcion: d.descripcion ?? '',
      importe: toImporteInput(Number(d.importe)),
    })),
  };
}

function descripcionVisible(line: DetalleDraft): string {
  const propia = line.descripcion.trim();
  if (propia) return propia;
  return line.cuenta_descripcion.trim();
}

function SidePanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`${spreadsheet.shell} overflow-hidden`}>
      <div className="flex items-center gap-2 border-b border-slate-300 bg-[#e2e8f0] px-4 py-2.5">
        {icon}
        <span className="text-sm font-semibold text-slate-700">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function AfectacionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission('afectaciones:write'));
  const { print, printing, downloadPdf, downloadingPdf } = usePrintAfectacion();
  const afectacionId = Number(id);

  const [anularModal, setAnularModal] = useState(false);
  const [leaveModal, setLeaveModal] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [formError, setFormError] = useState('');
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [editingFields, setEditingFields] = useState<Set<EditableField>>(new Set());
  const [baselineKey, setBaselineKey] = useState('');
  const [numeroManual, setNumeroManual] = useState(false);

  const { data: afectacion, isLoading, error } = useQuery({
    queryKey: ['afectacion', afectacionId],
    queryFn: () => getAfectacion(afectacionId),
    enabled: !isNaN(afectacionId),
  });

  const { data: expediente } = useQuery({
    queryKey: ['expediente', afectacion?.expediente_id],
    queryFn: () => getExpediente(afectacion!.expediente_id),
    enabled: !!afectacion?.expediente_id,
  });

  const { data: libramientosPage } = useQuery({
    queryKey: ['libramientos-de-afectacion', afectacion?.expediente_id, afectacionId],
    queryFn: () =>
      getLibramientos({ expedienteId: afectacion!.expediente_id, limit: 100 }),
    enabled: !!afectacion?.expediente_id,
  });

  const libramientosRelacionados = useMemo(
    () =>
      (libramientosPage?.data ?? []).filter((l) => l.afectacion_id === afectacionId),
    [libramientosPage, afectacionId]
  );

  const returnState = useMemo(
    () =>
      buildReturnState(
        `/afectaciones/${afectacionId}`,
        'Volver al detalle de la afectación'
      ),
    [afectacionId]
  );

  const puedeEditar = canWrite && !!afectacion && !afectacion.anulada;

  const { data: cuentas } = useQuery({
    queryKey: ['cuentas-disponibles', afectacionId],
    queryFn: () => getCuentasDisponibles(afectacionId),
    enabled: puedeEditar,
  });

  const anioCambio =
    !!afectacion && !!draft && draft.fecha.slice(0, 4) !== afectacion.fecha.slice(0, 4);
  const anioDraft = draft?.fecha ? Number(draft.fecha.slice(0, 4)) : undefined;

  const { data: siguienteNumero } = useQuery({
    queryKey: ['siguiente-numero-afectacion', anioDraft],
    queryFn: () => getSiguienteNumeroAfectacion(anioDraft),
    enabled: puedeEditar && !!anioDraft && (anioCambio || editingFields.has('numero')),
  });

  useEffect(() => {
    if (!afectacion) return;
    const key = `${afectacion.id}-${afectacion.updated_at}`;
    if (key === baselineKey) return;
    setDraft(draftFromAfectacion(afectacion));
    setEditingFields(new Set());
    setFormError('');
    setNumeroManual(false);
    setBaselineKey(key);
  }, [afectacion, baselineKey]);

  useEffect(() => {
    if (!afectacion || !draft || numeroManual) return;

    if (draft.fecha.slice(0, 4) === afectacion.fecha.slice(0, 4)) {
      if (String(afectacion.numero) !== draft.numero && !editingFields.has('numero')) {
        setDraft((prev) => (prev ? { ...prev, numero: String(afectacion.numero) } : prev));
      }
      return;
    }

    if (siguienteNumero && String(siguienteNumero.siguiente) !== draft.numero) {
      setDraft((prev) =>
        prev ? { ...prev, numero: String(siguienteNumero.siguiente) } : prev
      );
    }
  }, [afectacion, draft?.fecha, siguienteNumero, numeroManual]);

  const importeTotal = useMemo(() => {
    if (!draft) return 0;
    return draft.detalle.reduce((sum, l) => sum + (parseImporteAR(l.importe) || 0), 0);
  }, [draft]);

  const isDirty = useMemo(() => {
    if (!afectacion || !draft) return false;
    if (draft.fecha !== afectacion.fecha) return true;
    if (draft.destinatario.trim() !== afectacion.destinatario.trim()) return true;
    if (
      (draft.numeroComprobante.trim() || '') !== (afectacion.numero_comprobante?.trim() || '')
    ) {
      return true;
    }
    if ((draft.observaciones.trim() || '') !== (afectacion.observaciones?.trim() || '')) return true;
    if (parseInt(draft.numero, 10) !== afectacion.numero) return true;

    const original = afectacion.detalle ?? [];
    if (draft.detalle.length !== original.length) return true;
    return draft.detalle.some((line, i) => {
      const orig = original[i];
      if (!orig) return true;
      return (
        Number(line.cuenta_id) !== orig.cuenta_id ||
        line.descripcion.trim() !== orig.descripcion.trim() ||
        Math.abs((parseImporteAR(line.importe) || 0) - Number(orig.importe)) > 0.001
      );
    });
  }, [afectacion, draft]);

  const blocker = useBlocker(isDirty);

  useEffect(() => {
    if (blocker.state === 'blocked') setLeaveModal(true);
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
    queryClient.invalidateQueries({ queryKey: ['afectacion', afectacionId] });
    queryClient.invalidateQueries({ queryKey: ['afectaciones'] });
    queryClient.invalidateQueries({ queryKey: ['afectaciones-resumen'] });
    queryClient.invalidateQueries({ queryKey: ['expedientes'] });
    queryClient.invalidateQueries({ queryKey: ['cuentas'] });
    queryClient.invalidateQueries({ queryKey: ['cuentas-resumen'] });
    queryClient.invalidateQueries({ queryKey: ['cuentas-disponibles'] });
    queryClient.invalidateQueries({ queryKey: ['siguiente-numero-afectacion'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  };

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error('Sin datos');
      return updateAfectacion(afectacionId, {
        fecha: draft.fecha,
        destinatario: draft.destinatario.trim(),
        numero: draft.numero ? parseInt(draft.numero, 10) : undefined,
        importe: draft.detalle.reduce((sum, l) => sum + (parseImporteAR(l.importe) || 0), 0),
        numero_comprobante: draft.numeroComprobante.trim() || null,
        observaciones: draft.observaciones.trim() || null,
        detalle: draft.detalle
          .filter((l) => l.cuenta_id && l.importe)
          .map((l) => ({
            cuenta_id: Number(l.cuenta_id),
            descripcion: l.descripcion.trim(),
            importe: parseImporteAR(l.importe),
          })),
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

  const anularMutation = useMutation({
    mutationFn: () => anularAfectacion(afectacionId, motivo),
    onSuccess: () => {
      invalidate();
      setAnularModal(false);
      setMotivo('');
    },
    onError: (err) =>
      setFormError(err instanceof ApiClientError ? err.message : 'Error al anular'),
  });

  if (isLoading || !draft) {
    return <div className="py-12 text-center text-sm text-slate-500">Cargando...</div>;
  }

  if (error || !afectacion) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-sm text-slate-500">Afectación no encontrada</p>
        <DetailBackNav listTo="/afectaciones" listLabel="Volver a afectaciones" />
      </div>
    );
  }

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
    setDraft(draftFromAfectacion(afectacion));
    setEditingFields(new Set());
    setFormError('');
    setNumeroManual(false);
  };

  const handleSave = () => {
    if (!draft.fecha || !draft.destinatario.trim() || !draft.numero) {
      setFormError('Complete número, fecha y destinatario');
      return;
    }
    const validLines = draft.detalle.filter((l) => l.cuenta_id && l.importe);
    if (validLines.length === 0) {
      setFormError('Debe haber al menos una cuenta en el detalle');
      return;
    }
    for (const line of validLines) {
      const importe = parseImporteAR(line.importe);
      if (Number.isNaN(importe) || importe <= 0) {
        setFormError('Todos los importes deben ser mayores a cero');
        return;
      }
      const cuenta = cuentas?.find((c) => c.id === Number(line.cuenta_id));
      if (cuenta && importe > cuenta.saldo_disponible + 0.001) {
        setFormError(`Importe excede saldo disponible en cuenta ${cuenta.codigo}`);
        return;
      }
    }
    if (expediente && importeTotal > Number(expediente.importe) + 0.001) {
      setFormError(
        `El total (${formatCurrency(importeTotal)}) no puede superar el importe del expediente (${formatCurrency(expediente.importe)})`
      );
      return;
    }
    if (importeTotal <= 0) {
      setFormError('El importe de la afectación debe ser mayor a cero');
      return;
    }
    setFormError('');
    updateMutation.mutate();
  };

  const confirmLeave = () => {
    setLeaveModal(false);
    if (blocker.state === 'blocked') blocker.proceed();
  };

  const cancelLeave = () => {
    setLeaveModal(false);
    if (blocker.state === 'blocked') blocker.reset();
  };

  const previewNumero =
    draft.numero && draft.fecha && parseInt(draft.numero, 10) > 0
      ? formatAfectacionNumero(parseInt(draft.numero, 10), draft.fecha)
      : afectacion.numero_completo;

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
      value: renderEditableCell(
        'numero',
        <span className="font-mono text-base font-semibold text-slate-900">
          {previewNumero}
        </span>,
        <div className="flex items-stretch">
          <input
            type="number"
            min="1"
            value={draft.numero}
            onChange={(e) => {
              setNumeroManual(true);
              setDraft({ ...draft, numero: e.target.value });
            }}
            className={`${cellInput} font-mono`}
            autoFocus
          />
          {numeroManual && (
            <button
              type="button"
              onClick={() => {
                setNumeroManual(false);
                if (draft.fecha === afectacion.fecha) {
                  setDraft({ ...draft, numero: String(afectacion.numero) });
                } else if (siguienteNumero) {
                  setDraft({ ...draft, numero: String(siguienteNumero.siguiente) });
                }
              }}
              className="shrink-0 border-l border-slate-300 bg-slate-50 px-3 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Auto
            </button>
          )}
        </div>
      ),
    },
    {
      label: 'Fecha de emisión',
      value: renderEditableCell(
        'fecha',
        <span className="tabular-nums">{formatDate(draft.fecha)}</span>,
        <input
          type="date"
          value={draft.fecha}
          onChange={(e) => {
            setNumeroManual(false);
            setDraft({ ...draft, fecha: e.target.value });
          }}
          className={cellInput}
          autoFocus
        />
      ),
    },
    {
      label: 'Destinatario',
      value: renderEditableCell(
        'destinatario',
        <span className="font-medium text-slate-900">{draft.destinatario}</span>,
        <input
          value={draft.destinatario}
          onChange={(e) => setDraft({ ...draft, destinatario: e.target.value })}
          className={cellInput}
          autoFocus
        />
      ),
    },
    {
      label: 'Expediente',
      value: (
        <Link
          to={`/expedientes/${afectacion.expediente_id}`}
          state={returnState}
          className="inline-flex items-center gap-1.5 font-mono text-primary-700 hover:underline"
        >
          <FolderOpen size={14} />
          {afectacion.expediente_numero || `#${afectacion.expediente_id}`}
          <ExternalLink size={12} className="opacity-60" />
        </Link>
      ),
    },
    {
      label: 'Estado',
      value: afectacion.anulada ? (
        <StatusBadge label="Anulada" variant="danger" />
      ) : (
        <StatusBadge label="Activa" variant="success" />
      ),
    },
    {
      label: 'Nº comprobante',
      value: renderEditableCell(
        'numero_comprobante',
        <span className="font-mono text-slate-800">
          {draft.numeroComprobante || <span className="text-slate-400">—</span>}
        </span>,
        <input
          value={draft.numeroComprobante}
          onChange={(e) => setDraft({ ...draft, numeroComprobante: e.target.value })}
          maxLength={100}
          placeholder="Opcional"
          className={`${cellInput} font-mono`}
          autoFocus
        />
      ),
    },
    {
      label: 'Observaciones',
      value: renderEditableCell(
        'observaciones',
        <span className="whitespace-pre-wrap text-slate-700">
          {draft.observaciones || <span className="text-slate-400">—</span>}
        </span>,
        <textarea
          value={draft.observaciones}
          onChange={(e) => setDraft({ ...draft, observaciones: e.target.value })}
          rows={3}
          className="w-full min-w-0 resize-none rounded-none border-0 bg-transparent px-2 py-1.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500/40"
          autoFocus
        />,
        true
      ),
    },
    ...(afectacion.anulada && afectacion.motivo_anulacion
      ? [
          {
            label: 'Motivo anulación',
            value: (
              <span className="whitespace-pre-wrap text-red-700">
                {afectacion.motivo_anulacion}
              </span>
            ),
          },
        ]
      : []),
  ];

  const detalleColumns: SpreadsheetColumn<DetalleDraft>[] = [
    {
      key: 'cuenta',
      header: 'Código',
      width: 'w-28',
      render: (line, index) =>
        editingFields.has('detalle') ? (
          <select
            value={line.cuenta_id}
            onChange={(e) => {
              const cuentaId = e.target.value;
              const cuenta = cuentas?.find((c) => String(c.id) === cuentaId);
              const updated = [...draft.detalle];
              const prev = updated[index];
              updated[index] = {
                ...prev,
                cuenta_id: cuentaId,
                cuenta_codigo: cuenta?.codigo ?? '',
                cuenta_descripcion: cuenta?.descripcion ?? '',
                descripcion: prev.descripcion.trim() || cuenta?.descripcion || '',
              };
              setDraft({ ...draft, detalle: updated });
            }}
            className={cellSelect}
          >
            <option value="">Cuenta...</option>
            {cuentas?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} — {c.descripcion} (Disp: {formatCurrency(c.saldo_disponible)})
              </option>
            ))}
          </select>
        ) : (
          (() => {
            const codigo =
              line.cuenta_codigo ||
              cuentas?.find((c) => c.id === Number(line.cuenta_id))?.codigo ||
              afectacion.detalle?.find((d) => String(d.cuenta_id) === line.cuenta_id)
                ?.cuenta_codigo ||
              '';
            if (!codigo) {
              return <span className="text-slate-400">—</span>;
            }
            return (
              <Link
                to={`/plan-cuentas?q=${encodeURIComponent(codigo)}&exact=1`}
                state={returnState}
                className="font-mono font-medium text-primary-700 hover:underline"
                title="Ver en plan de cuentas"
              >
                {codigo}
              </Link>
            );
          })()
        ),
    },
    {
      key: 'cuenta_nombre',
      header: 'Cuenta',
      render: (line) => {
        if (editingFields.has('detalle')) {
          return (
            <span className="text-slate-500">
              {line.cuenta_descripcion || '—'}
            </span>
          );
        }
        return (
          <span className="text-slate-600">{line.cuenta_descripcion || '—'}</span>
        );
      },
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      render: (line, index) =>
        editingFields.has('detalle') ? (
          <input
            value={line.descripcion}
            onChange={(e) => {
              const updated = [...draft.detalle];
              updated[index] = { ...updated[index], descripcion: e.target.value };
              setDraft({ ...draft, detalle: updated });
            }}
            placeholder={line.cuenta_descripcion || 'Descripción de la cuenta'}
            className={cellInput}
          />
        ) : (
          <span className="text-slate-700">
            {descripcionVisible(line) || <span className="text-slate-400">—</span>}
          </span>
        ),
    },
    {
      key: 'importe',
      header: 'Importe',
      width: 'w-40',
      align: 'right',
      render: (line, index) =>
        editingFields.has('detalle') ? (
          <div className="flex items-center justify-end gap-1">
            <ImporteInput
              value={line.importe}
              onChange={(importe) => {
                const updated = [...draft.detalle];
                updated[index] = {
                  ...updated[index],
                  importe,
                };
                setDraft({ ...draft, detalle: updated });
              }}
              className={`${cellInput} text-right`}
            />
            {draft.detalle.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    detalle: draft.detalle.filter((_, i) => i !== index),
                  })
                }
                className="rounded p-1 text-red-500 hover:bg-red-50"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ) : (
          <span className="font-medium tabular-nums">
            {formatCurrency(parseImporteAR(line.importe) || 0)}
          </span>
        ),
    },
  ];

  const letrasTotal = importeEnLetras(importeTotal);
  const cuentasCount = draft.detalle.length;
  const expedienteImporte = expediente ? Number(expediente.importe) || 0 : 0;
  const pctExpediente =
    expedienteImporte > 0 ? (importeTotal / expedienteImporte) * 100 : null;

  return (
    <div className="space-y-4 pb-8">
      <DetailBackNav listTo="/afectaciones" listLabel="Volver a afectaciones" />

      {afectacion.anulada && (
        <Alert type="error">
          Afectación anulada
          {afectacion.fecha_anulacion
            ? ` el ${formatDate(afectacion.fecha_anulacion)}`
            : ''}
          {afectacion.motivo_anulacion ? `: ${afectacion.motivo_anulacion}` : '.'}
        </Alert>
      )}

      <SpreadsheetShell
        title={`Afectación ${previewNumero}`}
        subtitle={draft.destinatario}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void print(afectacionId)}
              disabled={printing || downloadingPdf || afectacion.anulada}
              title={
                afectacion.anulada
                  ? 'No se puede imprimir una afectación anulada'
                  : 'Imprimir comprobante'
              }
              className="inline-flex items-center gap-1.5 rounded bg-white/15 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Printer size={14} />
              {printing ? 'Preparando...' : 'Imprimir'}
            </button>
            <button
              type="button"
              onClick={() => void downloadPdf(afectacionId)}
              disabled={printing || downloadingPdf || afectacion.anulada}
              title={
                afectacion.anulada
                  ? 'No se puede descargar el PDF de una afectación anulada'
                  : 'Descargar comprobante en PDF'
              }
              className="inline-flex items-center gap-1.5 rounded bg-white/15 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download size={14} />
              {downloadingPdf ? 'Generando PDF...' : 'Descargar PDF'}
            </button>
            {canWrite && puedeEditar && (
              <>
                {isDirty && (
                  <button
                    type="button"
                    onClick={discardChanges}
                    className={`${spreadsheet.toolbarBtn} !text-primary-100 hover:!bg-primary-800`}
                  >
                    <X size={14} /> Descartar
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!isDirty || updateMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Check size={14} />
                  {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </>
            )}
            {canWrite && puedeEditar && (
              <button
                type="button"
                onClick={() => {
                  setFormError('');
                  setAnularModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
              >
                <Ban size={14} /> Anular
              </button>
            )}
          </div>
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            {afectacion.anulada ? (
              <StatusBadge label="Anulada" variant="danger" />
            ) : (
              <StatusBadge label="Activa" variant="success" />
            )}
            <span className="text-slate-400">|</span>
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
              <Calendar size={14} className="text-slate-400" />
              <span className="tabular-nums">{formatDate(draft.fecha)}</span>
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-sm text-slate-600">
              Total{' '}
              <strong className="tabular-nums text-emerald-700">
                {formatCurrency(importeTotal)}
              </strong>
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-sm text-slate-600">
              <span className="tabular-nums font-medium">{cuentasCount}</span>{' '}
              {cuentasCount === 1 ? 'cuenta' : 'cuentas'}
            </span>
            {isDirty && (
              <>
                <span className="text-slate-400">|</span>
                <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  Cambios sin guardar
                </span>
              </>
            )}
          </div>
        }
      >
        {formError && <SpreadsheetFormError>{formError}</SpreadsheetFormError>}

        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)]">
          <div className="min-w-0 border-b border-slate-200 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-200 bg-[#f8fafc] px-4 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Datos del documento
              </h2>
            </div>
            <SpreadsheetPropertyGrid rows={rows} />
          </div>

          <div className="flex min-w-0 flex-col bg-[#f8fafc]">
            <div className="border-b border-slate-200 px-4 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Resumen financiero
              </h2>
            </div>
            <div className="space-y-3 p-4">
              <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3.5 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-emerald-800/80">
                  Importe total
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">
                  {formatCurrency(importeTotal)}
                </div>
                <p className="mt-2 text-[11px] leading-snug text-emerald-900/70">
                  {letrasTotal}
                </p>
              </div>

              {expediente && (
                <div className="rounded-md border border-slate-200 bg-white px-3.5 py-3 text-sm">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <FolderOpen size={13} />
                    Respecto al expediente
                  </div>
                  <div className="space-y-1.5 tabular-nums">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Importe expediente</span>
                      <span className="font-medium text-slate-800">
                        {formatCurrency(expedienteImporte)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Esta afectación</span>
                      <span className="font-medium text-emerald-700">
                        {formatCurrency(importeTotal)}
                      </span>
                    </div>
                    {pctExpediente != null && (
                      <div className="flex justify-between gap-3 border-t border-slate-100 pt-1.5">
                        <span className="text-slate-500">Participación</span>
                        <span className="font-semibold text-slate-800">
                          {pctExpediente.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-md border border-slate-200 bg-white px-3.5 py-3 text-sm">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Receipt size={13} />
                  Detalle
                </div>
                <div className="space-y-1.5 tabular-nums">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Líneas de cuenta</span>
                    <span className="font-medium text-slate-800">{cuentasCount}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Total afectado</span>
                    <span className="font-bold text-emerald-700">
                      {formatCurrency(importeTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {libramientosRelacionados.length > 0 && (
                <div className="rounded-md border border-slate-200 bg-white px-3.5 py-3 text-sm">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Libramientos ({libramientosRelacionados.length})
                  </div>
                  <ul className="space-y-1.5">
                    {libramientosRelacionados.slice(0, 5).map((lib) => (
                      <li key={lib.id}>
                        <Link
                          to={`/libramientos/${lib.id}`}
                          state={returnState}
                          className="flex items-center justify-between gap-2 rounded px-1 py-0.5 font-mono text-primary-700 hover:bg-primary-50 hover:underline"
                        >
                          <span>{lib.numero_completo}</span>
                          <span className="tabular-nums text-xs text-slate-500">
                            {formatCurrency(lib.neto)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-md border border-slate-200 bg-white px-3.5 py-3 text-sm">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <User size={13} />
                  Registro
                </div>
                <dl className="space-y-1.5 text-slate-600">
                  {afectacion.usuario_creacion_nombre && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Creado por</dt>
                      <dd className="text-right font-medium text-slate-800">
                        {afectacion.usuario_creacion_nombre}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Registrado</dt>
                    <dd className="text-right tabular-nums">
                      {new Date(afectacion.created_at).toLocaleString('es-AR')}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Actualizado</dt>
                    <dd className="text-right tabular-nums">
                      {new Date(afectacion.updated_at).toLocaleString('es-AR')}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </SpreadsheetShell>

      <SpreadsheetSection
        title="Detalle de cuentas"
        toolbar={
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums text-slate-500">
              {cuentasCount} {cuentasCount === 1 ? 'línea' : 'líneas'}
            </span>
            {puedeEditar && (
              <>
                {editingFields.has('detalle') && (
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        detalle: [
                          ...draft.detalle,
                          {
                            key: `new-${Date.now()}`,
                            cuenta_id: '',
                            cuenta_codigo: '',
                            cuenta_descripcion: '',
                            descripcion: '',
                            importe: '',
                          },
                        ],
                      })
                    }
                    className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Plus size={14} /> Agregar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    editingFields.has('detalle')
                      ? stopEdit('detalle')
                      : startEdit('detalle')
                  }
                  className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition ${
                    editingFields.has('detalle')
                      ? 'bg-primary-100 text-primary-800'
                      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Pencil size={14} />
                  {editingFields.has('detalle') ? 'Cerrar edición' : 'Editar detalle'}
                </button>
              </>
            )}
          </div>
        }
      >
        <SpreadsheetGrid
          columns={detalleColumns}
          data={draft.detalle}
          rowKey={(line) => line.key}
          showRowNumbers
          emptyMessage="Sin cuentas en el detalle"
        />
        {cuentasCount > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-x-8 gap-y-2 border-t border-slate-300 bg-[#f1f5f9] px-4 py-2.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-600">Total afectado</span>
              <span className="text-base font-bold tabular-nums text-emerald-700">
                {formatCurrency(importeTotal)}
              </span>
            </div>
          </div>
        )}
      </SpreadsheetSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <SidePanel
          title="Documentos vinculados"
          icon={<FolderOpen size={15} className="text-slate-500" />}
        >
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link
                to={`/expedientes/${afectacion.expediente_id}`}
                state={returnState}
                className="group flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 transition hover:border-primary-300 hover:bg-primary-50/40"
              >
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Expediente
                  </div>
                  <div className="font-mono font-semibold text-primary-800 group-hover:underline">
                    {afectacion.expediente_numero || `#${afectacion.expediente_id}`}
                  </div>
                  {expediente?.proveedor_nombre && (
                    <div className="mt-0.5 text-xs text-slate-500">
                      {expediente.proveedor_nombre}
                    </div>
                  )}
                </div>
                <ExternalLink size={14} className="text-slate-400" />
              </Link>
            </li>
            {libramientosRelacionados.length === 0 ? (
              <li className="rounded-md border border-dashed border-slate-200 px-3 py-2.5 text-slate-500">
                Aún no hay libramientos generados desde esta afectación.
              </li>
            ) : (
              libramientosRelacionados.map((lib) => (
                <li key={lib.id}>
                  <Link
                    to={`/libramientos/${lib.id}`}
                    state={returnState}
                    className="group flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 transition hover:border-primary-300 hover:bg-primary-50/40"
                  >
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Libramiento
                        {lib.anulado ? ' · Anulado' : lib.pagado ? ' · Pagado' : ''}
                      </div>
                      <div className="font-mono font-semibold text-primary-800 group-hover:underline">
                        {lib.numero_completo}
                      </div>
                    </div>
                    <span className="tabular-nums text-sm font-medium text-slate-700">
                      {formatCurrency(lib.neto)}
                    </span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </SidePanel>

        <SidePanel
          title="Impresión"
          icon={<Printer size={15} className="text-slate-500" />}
        >
          <p className="mb-3 text-sm text-slate-600">
            Comprobante oficial en hoja A4. La plantilla se configura en Configuración →
            Impresiones → Afectaciones.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={printing || downloadingPdf || afectacion.anulada}
              onClick={() => void print(afectacionId)}
            >
              <Printer size={14} />
              {printing ? 'Preparando...' : 'Imprimir'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={printing || downloadingPdf || afectacion.anulada}
              onClick={() => void downloadPdf(afectacionId)}
            >
              <Download size={14} />
              {downloadingPdf ? 'Generando...' : 'Descargar PDF'}
            </Button>
          </div>
        </SidePanel>
      </div>

      <Modal open={leaveModal} onClose={cancelLeave} title="Cambios sin guardar" size="sm">
        <p className="mb-6 text-sm text-slate-600">
          Tiene cambios sin guardar en la afectación. Si sale ahora, se perderán.
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
        open={anularModal}
        onClose={() => setAnularModal(false)}
        title="Anular afectación"
        size="sm"
      >
        {formError && (
          <div className="mb-4">
            <Alert type="error">{formError}</Alert>
          </div>
        )}
        <p className="mb-4 text-sm text-slate-600">
          Se revertirán los saldos afectados en las cuentas. Si es la única afectación activa,
          el expediente volverá a estado Iniciado.
        </p>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          className="mb-4 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          placeholder="Motivo de anulación (mínimo 5 caracteres)"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setAnularModal(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={anularMutation.isPending}
            disabled={motivo.length < 5}
            onClick={() => anularMutation.mutate()}
          >
            Confirmar anulación
          </Button>
        </div>
      </Modal>
    </div>
  );
}
