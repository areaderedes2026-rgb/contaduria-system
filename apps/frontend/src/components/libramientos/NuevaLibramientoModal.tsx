import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AfectacionLibramientoCombobox } from '@/components/libramientos/AfectacionLibramientoCombobox';
import {
  SpreadsheetFormError,
  SpreadsheetFormFooter,
  cellInput,
  spreadsheet,
} from '@/components/spreadsheet';
import {
  createLibramiento,
  getAfectacionParaLibramiento,
  getAfectacionesDisponiblesLibramiento,
  getSiguienteNumeroLibramiento,
} from '@/services/libramientos.service';
import { ApiClientError } from '@/services/api';
import {
  formatCurrency,
  formatLibramientoNumero,
  toImporteInput,
  parseImporteAR,
} from '@/utils/format';
import { ImporteInput } from '@/components/ui/ImporteInput';
import type { AfectacionDisponibleLibramiento, Libramiento } from '@/types';

interface DetalleLine {
  afectacion_detalle_id: number;
  cuenta_id: number;
  cuenta_codigo: string;
  descripcion: string;
  importe: string;
  maxImporte: number;
}

interface RetencionLine {
  key: string;
  concepto: string;
  /** Por defecto porcentaje sobre el importe del libramiento. */
  modo: 'porcentaje' | 'importe';
  porcentaje: string;
  importe: string;
}

interface FormState {
  numero: string;
  fecha: string;
  beneficiario: string;
  concepto: string;
  expedienteNumero: string;
  numeroDecreto: string;
  observaciones: string;
}

const today = new Date().toISOString().slice(0, 10);
let retKeySeq = 0;
const nextRetKey = () => `ret-${Date.now()}-${++retKeySeq}`;

const emptyRetencion = (): RetencionLine => ({
  key: nextRetKey(),
  concepto: '',
  modo: 'porcentaje',
  porcentaje: '',
  importe: '',
});

/** Acepta 20, 20%, 20,5 o 20.5 → número. */
function parsePorcentaje(value: string): number {
  const cleaned = value.trim().replace(/%/g, '').replace(',', '.').replace(/\s/g, '');
  if (!cleaned) return NaN;
  return parseFloat(cleaned);
}

/** Formato simple para editar % (sin miles ni ,00 forzado). */
function formatPorcentajeInput(value: string): string {
  let cleaned = value.replace(/[^\d.,%]/g, '');
  const hasPercent = cleaned.includes('%');
  cleaned = cleaned.replace(/%/g, '');

  // Una sola coma o punto decimal
  const sepMatch = cleaned.match(/[.,]/g);
  if (sepMatch && sepMatch.length > 1) {
    const firstSep = cleaned.search(/[.,]/);
    cleaned =
      cleaned.slice(0, firstSep + 1) + cleaned.slice(firstSep + 1).replace(/[.,]/g, '');
  }

  // Máximo 2 decimales
  const sepIdx = cleaned.search(/[.,]/);
  if (sepIdx >= 0) {
    const intPart = cleaned.slice(0, sepIdx).replace(/\D/g, '') || '0';
    const decPart = cleaned.slice(sepIdx + 1).replace(/\D/g, '').slice(0, 2);
    cleaned = `${intPart}${cleaned[sepIdx]}${decPart}`;
  } else {
    cleaned = cleaned.replace(/\D/g, '');
  }

  if (!cleaned) return hasPercent ? '%' : '';
  return hasPercent ? `${cleaned}%` : cleaned;
}

function formatPorcentajeFromNumber(pct: number): string {
  if (!Number.isFinite(pct)) return '';
  const rounded = Math.round(pct * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded).replace('.', ',');
}

function importeRetencionLine(line: RetencionLine, baseImporte: number): number {
  if (line.modo === 'porcentaje') {
    const pct = parsePorcentaje(line.porcentaje);
    if (!line.porcentaje.trim() || Number.isNaN(pct) || pct < 0) return 0;
    return Number(((baseImporte * pct) / 100).toFixed(2));
  }
  const importe = parseImporteAR(line.importe);
  if (!line.importe.trim() || Number.isNaN(importe) || importe < 0) return 0;
  return Number(importe.toFixed(2));
}

const emptyForm = (): FormState => ({
  numero: '',
  fecha: today,
  beneficiario: '',
  concepto: '',
  expedienteNumero: '',
  numeroDecreto: '',
  observaciones: '',
});

const fieldLabel = `${spreadsheet.headerCell} bg-[#e8eef4] font-semibold text-slate-700`;
const fieldValue = 'border border-slate-300 bg-white px-2 py-1.5 align-middle';

interface NuevaLibramientoModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (libramiento: Libramiento) => void;
  /** Sin ventana propia (p. ej. pestaña dentro del modal unificado). */
  embedded?: boolean;
}

export function NuevaLibramientoModal({
  open,
  onClose,
  onCreated,
  embedded = false,
}: NuevaLibramientoModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [afectacionOpt, setAfectacionOpt] = useState<AfectacionDisponibleLibramiento | null>(null);
  const [detalle, setDetalle] = useState<DetalleLine[]>([]);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [retenciones, setRetenciones] = useState<RetencionLine[]>([emptyRetencion()]);
  const [formError, setFormError] = useState('');
  const [numeroManual, setNumeroManual] = useState(false);
  const [confirmDecretoOpen, setConfirmDecretoOpen] = useState(false);

  const anioForm = form.fecha ? Number(form.fecha.slice(0, 4)) : new Date().getFullYear();

  const { data: siguienteNumero, isLoading: loadingNumero } = useQuery({
    queryKey: ['siguiente-numero-libramiento', anioForm],
    queryFn: () => getSiguienteNumeroLibramiento(anioForm),
    enabled: open && !!form.fecha,
  });

  const { data: afectaciones = [], isFetching: loadingAfectaciones } = useQuery({
    queryKey: ['afectaciones-disponibles-libramiento'],
    queryFn: getAfectacionesDisponiblesLibramiento,
    enabled: open,
  });

  const afectacionId = afectacionOpt?.id ?? null;

  const { data: afectacionDetalle } = useQuery({
    queryKey: ['afectacion-para-libramiento', afectacionId],
    queryFn: () => getAfectacionParaLibramiento(afectacionId!),
    enabled: open && !!afectacionId,
  });

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setAfectacionOpt(null);
    setDetalle([]);
    setDetalleAbierto(false);
    setRetenciones([emptyRetencion()]);
    setFormError('');
    setNumeroManual(false);
    setConfirmDecretoOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open || numeroManual || !siguienteNumero) return;
    setForm((prev) => ({ ...prev, numero: String(siguienteNumero.siguiente) }));
  }, [open, numeroManual, siguienteNumero]);

  useEffect(() => {
    if (!afectacionDetalle?.detalle) return;
    setDetalle(
      afectacionDetalle.detalle.map((d) => ({
        afectacion_detalle_id: d.id,
        cuenta_id: d.cuenta_id,
        cuenta_codigo: d.cuenta_codigo ?? '',
        descripcion: d.descripcion?.trim() || d.cuenta_descripcion || '',
        importe: toImporteInput(Number(d.importe)),
        maxImporte: Number(d.importe),
      }))
    );
    setForm((prev) => ({
      ...prev,
      beneficiario:
        afectacionDetalle.proveedor_nombre ||
        afectacionDetalle.destinatario ||
        prev.beneficiario,
      concepto: afectacionDetalle.expediente_detalle || prev.concepto,
      expedienteNumero:
        afectacionDetalle.expediente_numero || prev.expedienteNumero,
    }));
  }, [afectacionDetalle]);

  const previewNumero =
    form.numero && form.fecha && parseInt(form.numero, 10) > 0
      ? formatLibramientoNumero(parseInt(form.numero, 10), form.fecha)
      : '—';

  const importeTotal = useMemo(
    () => detalle.reduce((sum, l) => sum + (parseImporteAR(l.importe) || 0), 0),
    [detalle]
  );

  const retencionesTotal = useMemo(
    () =>
      Number(
        retenciones
          .reduce((sum, r) => sum + importeRetencionLine(r, importeTotal), 0)
          .toFixed(2)
      ),
    [retenciones, importeTotal]
  );

  const neto = Math.max(0, Number((importeTotal - retencionesTotal).toFixed(2)));

  const createMutation = useMutation({
    mutationFn: () =>
      createLibramiento({
        fecha: form.fecha,
        afectacion_id: afectacionId!,
        beneficiario: form.beneficiario.trim() || undefined,
        importe: importeTotal,
        retenciones: retencionesTotal,
        numero: form.numero ? parseInt(form.numero, 10) : undefined,
        numero_decreto: form.numeroDecreto.trim() || null,
        observaciones: form.observaciones.trim() || undefined,
        detalle: detalle
          .filter((l) => l.cuenta_id && l.importe)
          .map((l) => ({
            afectacion_detalle_id: l.afectacion_detalle_id,
            cuenta_id: l.cuenta_id,
            descripcion: l.descripcion.trim() || 'Sin descripción',
            importe: parseImporteAR(l.importe),
          })),
      }),
    onSuccess: (created) => {
      setConfirmDecretoOpen(false);
      queryClient.invalidateQueries({ queryKey: ['libramientos'] });
      queryClient.invalidateQueries({ queryKey: ['libramientos-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['siguiente-numero-libramiento'] });
      queryClient.invalidateQueries({ queryKey: ['afectaciones'] });
      queryClient.invalidateQueries({ queryKey: ['afectaciones-disponibles-libramiento'] });
      queryClient.invalidateQueries({ queryKey: ['expedientes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      onCreated?.(created);
      onClose();
    },
    onError: (err) => {
      setConfirmDecretoOpen(false);
      setFormError(err instanceof ApiClientError ? err.message : 'Error al crear libramiento');
    },
  });

  const handleSelectAfectacion = (af: AfectacionDisponibleLibramiento | null) => {
    setAfectacionOpt(af);
    if (af) {
      setForm((prev) => ({
        ...prev,
        beneficiario: af.proveedor_nombre || af.destinatario,
        concepto: af.expediente_detalle || '',
        expedienteNumero: af.expediente_numero,
      }));
    } else {
      setDetalle([]);
      setForm((prev) => ({
        ...prev,
        beneficiario: '',
        concepto: '',
        expedienteNumero: '',
      }));
    }
  };

  const updateDetalle = (index: number, field: 'descripcion' | 'importe', value: string) => {
    const updated = [...detalle];
    updated[index] = { ...updated[index], [field]: value };
    setDetalle(updated);
  };

  const updateRetencion = (
    index: number,
    patch: Partial<Omit<RetencionLine, 'key'>>
  ) => {
    const updated = [...retenciones];
    updated[index] = { ...updated[index], ...patch };
    setRetenciones(updated);
  };

  const setRetencionModo = (index: number, modo: RetencionLine['modo']) => {
    const line = retenciones[index];
    if (!line || line.modo === modo) return;

    if (modo === 'importe') {
      const computed = importeRetencionLine(line, importeTotal);
      updateRetencion(index, {
        modo: 'importe',
        importe: computed > 0 ? toImporteInput(computed) : '',
      });
      return;
    }

    const importe = parseImporteAR(line.importe);
    const pct =
      importeTotal > 0 && !Number.isNaN(importe) && importe > 0
        ? Number(((importe / importeTotal) * 100).toFixed(2))
        : NaN;
    updateRetencion(index, {
      modo: 'porcentaje',
      porcentaje: Number.isNaN(pct) ? line.porcentaje : formatPorcentajeFromNumber(pct),
    });
  };

  const validateForm = (): string | null => {
    if (!afectacionId) return 'Seleccione una afectación';
    if (!form.beneficiario.trim()) return 'Indique el beneficiario (proveedor)';
    if (!form.numero || parseInt(form.numero, 10) <= 0) return 'Indique un número válido';
    if (detalle.length === 0) return 'La afectación no tiene detalle de cuentas';

    for (const line of detalle) {
      const importe = parseImporteAR(line.importe);
      if (Number.isNaN(importe) || importe <= 0) return 'Todos los importes deben ser mayores a cero';
      if (importe > line.maxImporte + 0.001) {
        return `El importe supera el monto afectado en la cuenta ${line.cuenta_codigo || ''}`.trim();
      }
    }

    if (afectacionDetalle && importeTotal > afectacionDetalle.importe_total + 0.001) {
      return `El importe no puede superar ${formatCurrency(afectacionDetalle.importe_total)}`;
    }

    if (retencionesTotal > importeTotal + 0.001) {
      return 'Las retenciones no pueden superar el importe';
    }
    for (const line of retenciones) {
      if (line.modo === 'porcentaje') {
        const pct = parsePorcentaje(line.porcentaje);
        if (line.porcentaje.trim() && !Number.isNaN(pct) && pct > 100) {
          return 'El porcentaje de una retención no puede superar el 100%';
        }
      }
    }
    if (neto < 0) return 'El neto no puede ser negativo';

    return null;
  };

  const canSubmit =
    !!form.fecha &&
    !!afectacionId &&
    !!form.beneficiario.trim() &&
    !!form.numero &&
    parseInt(form.numero, 10) > 0 &&
    detalle.length > 0 &&
    importeTotal > 0;

  const tryCreate = () => {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError('');

    if (!form.numeroDecreto.trim()) {
      setConfirmDecretoOpen(true);
      return;
    }

    createMutation.mutate();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setFormError(validateForm() ?? 'Complete todos los campos obligatorios');
      return;
    }
    tryCreate();
  };

  const formNode = (
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-300 bg-[#e8eef4] px-5 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Número asignado
              </p>
              <p className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-primary-900 sm:text-3xl">
                {loadingNumero ? '…' : previewNumero}
              </p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>Correlativo del año</p>
              <p className="font-mono tabular-nums">{form.fecha ? anioForm : '—'}</p>
            </div>
          </div>

          {formError && <SpreadsheetFormError>{formError}</SpreadsheetFormError>}

          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(340px,1.1fr)_minmax(280px,0.9fr)]">
            {/* Izquierda: datos */}
            <div className="flex min-w-0 flex-col border-b border-slate-300 lg:border-b-0 lg:border-r">
              <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Datos del libramiento
              </div>
              <table className={`${spreadsheet.table} table-fixed border-0`}>
                <tbody>
                  <tr>
                    <td className={`${fieldLabel} w-36`}>Número</td>
                    <td className={fieldValue}>
                      <div className="flex items-stretch">
                        <input
                          type="number"
                          min="1"
                          value={form.numero}
                          onChange={(e) => {
                            setNumeroManual(true);
                            setForm({ ...form, numero: e.target.value });
                          }}
                          className={`${cellInput} font-mono`}
                        />
                        {numeroManual && (
                          <button
                            type="button"
                            onClick={() => {
                              setNumeroManual(false);
                              if (siguienteNumero) {
                                setForm((prev) => ({
                                  ...prev,
                                  numero: String(siguienteNumero.siguiente),
                                }));
                              }
                            }}
                            className="shrink-0 border-l border-slate-300 bg-slate-50 px-3 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          >
                            Auto
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className={`${fieldLabel} w-36`}>Fecha</td>
                    <td className={fieldValue}>
                      <input
                        type="date"
                        value={form.fecha}
                        onChange={(e) => {
                          setNumeroManual(false);
                          setForm({ ...form, fecha: e.target.value });
                        }}
                        required
                        className={cellInput}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className={`${fieldLabel} w-36`}>Afectación</td>
                    <td className={`${fieldValue} overflow-visible`}>
                      <AfectacionLibramientoCombobox
                        value={afectacionOpt}
                        onChange={handleSelectAfectacion}
                        options={afectaciones}
                        loading={loadingAfectaciones}
                        variant="cell"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className={`${fieldLabel} w-36`}>Beneficiario</td>
                    <td className={fieldValue}>
                      <input
                        value={form.beneficiario}
                        onChange={(e) => setForm({ ...form, beneficiario: e.target.value })}
                        required
                        placeholder="Proveedor de la afectación"
                        className={cellInput}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className={`${fieldLabel} w-36`}>Nº expediente</td>
                    <td className={fieldValue}>
                      <input
                        value={form.expedienteNumero}
                        readOnly
                        className={`${cellInput} bg-slate-50 font-mono text-slate-700`}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className={`${fieldLabel} w-36 align-top`}>Concepto</td>
                    <td className={fieldValue}>
                      <textarea
                        value={form.concepto}
                        readOnly
                        rows={2}
                        placeholder="Se completa con el detalle del expediente"
                        className="w-full min-w-0 resize-none rounded-none border-0 bg-slate-50 px-2 py-2 text-sm text-slate-700 placeholder:text-slate-400"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className={`${fieldLabel} w-36`}>Nº decreto</td>
                    <td className={fieldValue}>
                      <input
                        value={form.numeroDecreto}
                        onChange={(e) => setForm({ ...form, numeroDecreto: e.target.value })}
                        placeholder="Opcional — Decreto / Resolución"
                        className={cellInput}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className={`${fieldLabel} w-36`}>Importe</td>
                    <td className={fieldValue}>
                      <span className="block px-2 py-1.5 font-mono text-base font-semibold tabular-nums text-primary-900">
                        {formatCurrency(importeTotal)}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className={`${fieldLabel} w-36 align-top`}>Observaciones</td>
                    <td className={fieldValue}>
                      <textarea
                        value={form.observaciones}
                        onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                        rows={2}
                        placeholder="Opcional"
                        className="w-full min-w-0 resize-none rounded-none border-0 bg-transparent px-2 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500/40"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              {detalle.length > 0 && (
                <div className="border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setDetalleAbierto((v) => !v)}
                    className="flex w-full items-center justify-between gap-2 bg-slate-100 px-4 py-2 text-left transition hover:bg-slate-200/80"
                    aria-expanded={detalleAbierto}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {detalleAbierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      Detalle de cuentas
                    </span>
                    <span className="text-[11px] font-medium tabular-nums text-slate-500">
                      {detalle.length} cuenta{detalle.length !== 1 ? 's' : ''} ·{' '}
                      {formatCurrency(importeTotal)}
                      {!detalleAbierto && (
                        <span className="ml-2 text-primary-700">Ver</span>
                      )}
                    </span>
                  </button>

                  {detalleAbierto && (
                    <div className="divide-y divide-slate-200">
                      <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,0.9fr)] bg-[#e8eef4] text-[11px] font-semibold uppercase tracking-wide text-slate-600 sm:grid">
                        <div className="px-3 py-1.5">Cuenta</div>
                        <div className="px-3 py-1.5">Descripción</div>
                        <div className="px-3 py-1.5 text-right">Importe</div>
                      </div>
                      {detalle.map((line, index) => (
                        <div
                          key={line.afectacion_detalle_id}
                          className="grid gap-0 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,0.9fr)]"
                        >
                          <div className="border-r border-slate-100 px-3 py-2 font-mono text-sm text-primary-800">
                            {line.cuenta_codigo || '—'}
                            <span className="mt-0.5 block text-[10px] text-slate-400">
                              máx. {formatCurrency(line.maxImporte)}
                            </span>
                          </div>
                          <input
                            value={line.descripcion}
                            onChange={(e) => updateDetalle(index, 'descripcion', e.target.value)}
                            className={cellInput}
                          />
                          <ImporteInput
                            value={line.importe}
                            onChange={(importe) => updateDetalle(index, 'importe', importe)}
                            className={`${cellInput} text-right`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Derecha: retenciones */}
            <div className="flex min-h-70 min-w-0 flex-col">
              <div className="flex items-center justify-between gap-2 border-b border-slate-300 bg-slate-100 px-4 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Retenciones
                </span>
                <span className="text-[11px] text-slate-500">
                  % sobre el importe · o importe fijo
                </span>
              </div>

              <div className="flex-1 divide-y divide-slate-200">
                <div className="hidden grid-cols-[minmax(0,1.3fr)_4.5rem_minmax(0,1fr)_2rem] bg-[#e8eef4] text-[11px] font-semibold uppercase tracking-wide text-slate-600 sm:grid">
                  <div className="px-3 py-1.5">Concepto</div>
                  <div className="px-2 py-1.5 text-center">Tipo</div>
                  <div className="px-3 py-1.5 text-right">Valor</div>
                  <div />
                </div>

                {retenciones.map((line, index) => {
                  const importeLinea = importeRetencionLine(line, importeTotal);

                  return (
                    <div
                      key={line.key}
                      className="grid grid-cols-1 gap-1 border-b border-slate-100 px-2 py-2 sm:grid-cols-[minmax(0,1.3fr)_4.5rem_minmax(0,1fr)_auto] sm:gap-0 sm:border-b-0 sm:px-0 sm:py-0"
                    >
                      <input
                        value={line.concepto}
                        onChange={(e) => updateRetencion(index, { concepto: e.target.value })}
                        placeholder="Concepto (opcional)"
                        className={cellInput}
                      />

                      <div className="flex items-stretch sm:border-l sm:border-slate-200">
                        <div className="flex w-full items-center justify-center gap-0.5 px-1 py-1">
                          <button
                            type="button"
                            onClick={() => setRetencionModo(index, 'porcentaje')}
                            className={`min-w-8 rounded px-1.5 py-1 text-xs font-semibold transition ${
                              line.modo === 'porcentaje'
                                ? 'bg-primary-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                            title="Por porcentaje"
                          >
                            %
                          </button>
                          <button
                            type="button"
                            onClick={() => setRetencionModo(index, 'importe')}
                            className={`min-w-8 rounded px-1.5 py-1 text-xs font-semibold transition ${
                              line.modo === 'importe'
                                ? 'bg-primary-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                            title="Por importe"
                          >
                            $
                          </button>
                        </div>
                      </div>

                      <div className="min-w-0 sm:border-l sm:border-slate-200">
                        {line.modo === 'porcentaje' ? (
                          <div className="flex min-h-9 items-stretch">
                            <div className="relative min-w-0 flex-1">
                              <input
                                value={line.porcentaje}
                                onChange={(e) =>
                                  updateRetencion(index, {
                                    porcentaje: formatPorcentajeInput(e.target.value),
                                  })
                                }
                                placeholder="20"
                                inputMode="decimal"
                                className={`${cellInput} pr-7 text-right`}
                                aria-label="Porcentaje de retención"
                              />
                              {!line.porcentaje.includes('%') && (
                                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                                  %
                                </span>
                              )}
                            </div>
                            <div className="flex min-w-[5.5rem] shrink-0 items-center justify-end border-l border-slate-200 bg-slate-50 px-2 text-right text-[11px] tabular-nums text-slate-600">
                              {importeLinea > 0 ? (
                                <span title="Importe calculado">{formatCurrency(importeLinea)}</span>
                              ) : (
                                <span className="text-slate-400">$ 0,00</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <ImporteInput
                            value={line.importe}
                            onChange={(importe) => updateRetencion(index, { importe })}
                            placeholder="0,00"
                            className={`${cellInput} text-right`}
                            aria-label="Importe de retención"
                          />
                        )}
                      </div>

                      {retenciones.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setRetenciones(retenciones.filter((_, i) => i !== index))
                          }
                          className="flex items-center justify-center border-l border-slate-200 px-2 text-red-500 hover:bg-red-50"
                          title="Quitar"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <div className="border-l border-slate-200" />
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setRetenciones((prev) => [...prev, emptyRetencion()])}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-500 transition hover:bg-primary-50/60"
                >
                  <Plus size={15} className="text-primary-500" />
                  Agregar retención...
                </button>
              </div>

              <div className="mt-auto space-y-2 border-t border-slate-300 bg-slate-50 px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {formatCurrency(importeTotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Retenciones</span>
                  <span className="font-mono tabular-nums text-amber-700">
                    {formatCurrency(retencionesTotal)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-semibold text-slate-800">Líquido a pagar</span>
                  <span className="font-mono text-base font-bold tabular-nums text-emerald-700">
                    {formatCurrency(neto)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <SpreadsheetFormFooter
            info={
              <>
                <span>
                  Importe:{' '}
                  <strong className="font-mono text-primary-800">{formatCurrency(importeTotal)}</strong>
                </span>
                <span className="hidden text-slate-400 sm:inline">|</span>
                <span>
                  Neto:{' '}
                  <strong className="font-mono text-emerald-700">{formatCurrency(neto)}</strong>
                </span>
              </>
            }
          >
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending}
              disabled={!canSubmit || createMutation.isPending}
            >
              Confirmar libramiento
            </Button>
          </SpreadsheetFormFooter>
        </form>
  );

  return (
    <>
      {embedded ? (
        formNode
      ) : (
        <Modal open={open} onClose={onClose} title="Nuevo libramiento de pago" size="2xl" flush>
          {formNode}
        </Modal>
      )}

      <Modal
        open={confirmDecretoOpen}
        onClose={() => setConfirmDecretoOpen(false)}
        title="Número de decreto pendiente"
        size="sm"
        stackLevel={embedded ? 1 : 0}
      >
        <p className="mb-2 text-sm text-slate-600">
          No indicó el <strong>Nº de Decreto / Resolución</strong>. Puede cargarlo después, pero
          conviene tenerlo para el comprobante oficial.
        </p>
        <p className="mb-5 text-sm text-slate-500">¿Desea continuar sin número de decreto?</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDecretoOpen(false)}>
            Volver a completar
          </Button>
          <Button loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
            Continuar sin decreto
          </Button>
        </div>
      </Modal>
    </>
  );
}
