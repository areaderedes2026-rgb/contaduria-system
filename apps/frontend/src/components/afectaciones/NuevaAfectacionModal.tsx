import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ExpedienteCombobox } from '@/components/afectaciones/ExpedienteCombobox';
import { CuentaCombobox } from '@/components/afectaciones/CuentaCombobox';
import { DestinatarioProveedoresField } from '@/components/afectaciones/DestinatarioProveedoresField';
import { NuevoExpedienteModal } from '@/components/expedientes/NuevoExpedienteModal';
import {
  SpreadsheetFormError,
  SpreadsheetFormFooter,
  cellInput,
  spreadsheet,
} from '@/components/spreadsheet';
import {
  createAfectacion,
  getCuentasDisponibles,
  getExpedientesDisponibles,
  getSiguienteNumeroAfectacion,
} from '@/services/afectaciones.service';
import { ApiClientError } from '@/services/api';
import {
  formatAfectacionNumero,
  formatCurrency,
  toImporteInput,
  parseImporteAR,
} from '@/utils/format';
import { formatProveedoresNombres } from '@/utils/proveedores';
import { ImporteInput } from '@/components/ui/ImporteInput';
import type { CuentaDisponible, Expediente, ExpedienteDisponible, ExpedienteProveedorRef } from '@/types';

function resolveProveedores(exp: ExpedienteDisponible | Expediente | null): ExpedienteProveedorRef[] {
  if (!exp) return [];
  if (exp.proveedores && exp.proveedores.length > 0) return exp.proveedores;
  if (exp.proveedor_nombre) {
    return [{ id: 'proveedor_id' in exp ? exp.proveedor_id : 0, nombre: exp.proveedor_nombre }];
  }
  return [];
}

function expedienteToDisponible(exp: Expediente): ExpedienteDisponible {
  const proveedores = resolveProveedores(exp);
  return {
    id: exp.id,
    numero_completo: exp.numero_completo,
    proveedor_nombre: formatProveedoresNombres(proveedores) || exp.proveedor_nombre || '',
    proveedores,
    detalle: exp.detalle,
    importe: exp.importe,
    importe_afectado: 0,
    importe_disponible: exp.importe,
    afectaciones_activas: 0,
    afectaciones: [],
  };
}

interface DetalleLine {
  key: string;
  cuenta: CuentaDisponible | null;
  descripcion: string;
  importe: string;
}

interface FormState {
  numero: string;
  fecha: string;
  destinatario: string;
  importe: string;
  numeroComprobante: string;
  observaciones: string;
}

const today = new Date().toISOString().slice(0, 10);
let lineKeySeq = 0;
const nextLineKey = () => `line-${Date.now()}-${++lineKeySeq}`;
const emptyLine = (): DetalleLine => ({
  key: nextLineKey(),
  cuenta: null,
  descripcion: '',
  importe: '',
});
const emptyForm = (): FormState => ({
  numero: '',
  fecha: today,
  destinatario: '',
  importe: '',
  numeroComprobante: '',
  observaciones: '',
});

const fieldLabel = `${spreadsheet.headerCell} bg-[#e8eef4] font-semibold text-slate-700`;
const fieldValue = 'border border-slate-300 bg-white px-2 py-1.5 align-middle';

interface NuevaAfectacionModalProps {
  open: boolean;
  onClose: () => void;
  /** Se llama con la afectación creada (antes de cerrar el modal). */
  onCreated?: (afectacion: import('@/types').Afectacion) => void;
}

export function NuevaAfectacionModal({ open, onClose, onCreated }: NuevaAfectacionModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [expediente, setExpediente] = useState<ExpedienteDisponible | null>(null);
  const [detalle, setDetalle] = useState<DetalleLine[]>([emptyLine()]);
  const [formError, setFormError] = useState('');
  const [numeroManual, setNumeroManual] = useState(false);
  const [confirmPartialOpen, setConfirmPartialOpen] = useState(false);
  const [nuevoExpedienteOpen, setNuevoExpedienteOpen] = useState(false);
  const [focusCuenta, setFocusCuenta] = useState<{ index: number; token: number } | null>(null);
  const [destinatarioIds, setDestinatarioIds] = useState<number[]>([]);
  const destinatarioFocusRef = useRef<HTMLButtonElement | null>(null);

  const anioForm = form.fecha ? Number(form.fecha.slice(0, 4)) : new Date().getFullYear();

  const { data: siguienteNumero, isLoading: loadingNumero } = useQuery({
    queryKey: ['siguiente-numero-afectacion', anioForm],
    queryFn: () => getSiguienteNumeroAfectacion(anioForm),
    enabled: open && !!form.fecha,
  });

  const { data: expedientes = [], isFetching: loadingExpedientes } = useQuery({
    queryKey: ['expedientes-disponibles'],
    queryFn: getExpedientesDisponibles,
    enabled: open,
  });

  const { data: cuentas = [], isFetching: loadingCuentas } = useQuery({
    queryKey: ['cuentas-disponibles'],
    queryFn: () => getCuentasDisponibles(),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setExpediente(null);
    setDetalle([emptyLine()]);
    setFormError('');
    setNumeroManual(false);
    setConfirmPartialOpen(false);
    setNuevoExpedienteOpen(false);
    setFocusCuenta(null);
    setDestinatarioIds([]);
  }, [open]);

  useEffect(() => {
    if (!open || numeroManual || !siguienteNumero) return;
    setForm((prev) => ({ ...prev, numero: String(siguienteNumero.siguiente) }));
  }, [open, numeroManual, siguienteNumero]);

  const previewNumero =
    form.numero && form.fecha && parseInt(form.numero, 10) > 0
      ? formatAfectacionNumero(parseInt(form.numero, 10), form.fecha)
      : '—';

  const importeAfectacion = parseImporteAR(form.importe) || 0;
  const importeDetalle = useMemo(
    () => detalle.reduce((sum, l) => sum + (parseImporteAR(l.importe) || 0), 0),
    [detalle]
  );
  const diferencia = Number((importeAfectacion - importeDetalle).toFixed(2));
  const totalCompleto =
    importeDetalle > 0 &&
    (importeAfectacion <= 0 || Math.abs(importeAfectacion - importeDetalle) <= 0.001);
  /** Cuentas suman menos que el importe indicado en el formulario */
  const importeIncompleto = importeDetalle > 0 && diferencia > 0.001;
  /** Saldo del expediente que quedaría libre con lo asignado en cuentas */
  const remanenteExpediente = expediente
    ? Number((expediente.importe_disponible - importeDetalle).toFixed(2))
    : 0;
  const quedaDisponibleEnExpediente = !!expediente && remanenteExpediente > 0.001;
  const requiereConfirmacion = importeIncompleto || quedaDisponibleEnExpediente;

  const createMutation = useMutation({
    mutationFn: () =>
      createAfectacion({
        fecha: form.fecha,
        expediente_id: expediente!.id,
        destinatario: form.destinatario.trim() || undefined,
        numero: form.numero ? parseInt(form.numero, 10) : undefined,
        // El total real es lo asignado en cuentas (permite afectaciones parciales)
        importe: importeDetalle,
        numero_comprobante: form.numeroComprobante.trim() || null,
        observaciones: form.observaciones.trim() || null,
        detalle: detalle
          .filter((l) => l.cuenta && l.importe)
          .map((l) => ({
            cuenta_id: l.cuenta!.id,
            descripcion: l.descripcion.trim(),
            importe: parseImporteAR(l.importe),
          })),
      }),
    onSuccess: (created) => {
      setConfirmPartialOpen(false);
      queryClient.invalidateQueries({ queryKey: ['afectaciones'] });
      queryClient.invalidateQueries({ queryKey: ['afectaciones-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['siguiente-numero-afectacion'] });
      queryClient.invalidateQueries({ queryKey: ['expedientes'] });
      queryClient.invalidateQueries({ queryKey: ['expedientes-disponibles'] });
      queryClient.invalidateQueries({ queryKey: ['expediente'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas-disponibles'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      onCreated?.(created);
      onClose();
    },
    onError: (err) => {
      setConfirmPartialOpen(false);
      setFormError(err instanceof ApiClientError ? err.message : 'Error al crear afectación');
    },
  });

  const handleExpedienteChange = (exp: ExpedienteDisponible | null) => {
    setExpediente(exp);
    const proveedores = resolveProveedores(exp);
    const ids = proveedores.map((p) => p.id).filter((id) => id > 0);
    const destinatario =
      proveedores.length <= 1
        ? formatProveedoresNombres(proveedores) || exp?.proveedor_nombre || ''
        : '';
    setDestinatarioIds(proveedores.length === 1 ? ids : []);
    const disponible = exp?.importe_disponible ?? 0;
    setForm((prev) => ({
      ...prev,
      destinatario,
      importe: exp ? toImporteInput(disponible) : '',
    }));
    if (exp) {
      setDetalle([
        {
          key: nextLineKey(),
          cuenta: null,
          descripcion: '',
          importe: toImporteInput(disponible),
        },
      ]);
      if (proveedores.length > 1) {
        setFocusCuenta(null);
        requestAnimationFrame(() => {
          destinatarioFocusRef.current?.focus();
        });
      } else {
        setFocusCuenta({ index: 0, token: Date.now() });
      }
    } else {
      setDetalle([emptyLine()]);
      setFocusCuenta(null);
    }
  };

  const handleExpedienteCreated = (created: Expediente) => {
    const disponible = expedienteToDisponible(created);
    void queryClient.invalidateQueries({ queryKey: ['expedientes-disponibles'] });
    handleExpedienteChange(disponible);
    setNuevoExpedienteOpen(false);
  };

  const expedienteProveedores = resolveProveedores(expediente);
  const multiProveedores = expedienteProveedores.length > 1;

  const updateLine = (index: number, patch: Partial<Omit<DetalleLine, 'key'>>) => {
    const updated = [...detalle];
    updated[index] = { ...updated[index], ...patch };
    setDetalle(updated);
  };

  const addCuentaLine = () => {
    const emptyIdx = detalle.findIndex((l) => !l.cuenta);
    if (emptyIdx >= 0) {
      setFocusCuenta({ index: emptyIdx, token: Date.now() });
      return;
    }
    setDetalle((prev) => [...prev, emptyLine()]);
    setFocusCuenta({ index: detalle.length, token: Date.now() });
  };

  const removeLine = (index: number) => {
    if (detalle.length <= 1) return;
    setDetalle(detalle.filter((_, i) => i !== index));
    setFocusCuenta(null);
  };

  const validateDetalle = (): string | null => {
    const validLines = detalle.filter((l) => l.cuenta && l.importe);
    if (validLines.length === 0) return 'Debe agregar al menos una cuenta con importe';

    for (const line of validLines) {
      const importe = parseImporteAR(line.importe);
      if (Number.isNaN(importe) || importe <= 0) return 'Todos los importes deben ser mayores a cero';
      if (line.cuenta && importe > line.cuenta.saldo_disponible + 0.001) {
        return `Importe excede saldo disponible en cuenta ${line.cuenta.codigo}`;
      }
    }

    if (!importeDetalle || importeDetalle <= 0) {
      return 'Indique al menos un importe en las cuentas';
    }

    if (expediente && importeDetalle > expediente.importe_disponible + 0.001) {
      return `El importe asignado supera el disponible del expediente (${formatCurrency(expediente.importe_disponible)})`;
    }

    // Solo bloquea si las cuentas superan el importe indicado (de más)
    if (importeAfectacion > 0 && diferencia < -0.001) {
      return `Las cuentas superan el importe de la afectación en ${formatCurrency(Math.abs(diferencia))}`;
    }

    return null;
  };

  const canSubmit =
    !!form.fecha &&
    !!expediente &&
    !!form.destinatario.trim() &&
    !!form.numero &&
    parseInt(form.numero, 10) > 0 &&
    importeDetalle > 0 &&
    !(importeAfectacion > 0 && diferencia < -0.001);

  const tryCreate = () => {
    const validationError = validateDetalle();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError('');

    if (requiereConfirmacion) {
      setConfirmPartialOpen(true);
      return;
    }

    createMutation.mutate();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      const validationError = validateDetalle();
      setFormError(validationError ?? 'Complete todos los campos obligatorios');
      return;
    }
    tryCreate();
  };

  const confirmPartialAndCreate = () => {
    createMutation.mutate();
  };

  return (
    <>
    <Modal
      open={open}
      onClose={() => {
        if (nuevoExpedienteOpen || confirmPartialOpen) return;
        onClose();
      }}
      title="Nueva afectación presupuestaria"
      size="2xl"
      flush
    >
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

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.4fr)]">
          {/* Izquierda: todos los datos. min-w-0 + table-fixed evitan que el
              contenido (p. ej. la tarjeta del expediente) ensanche la columna
              y se monte sobre el detalle de cuentas. */}
          <div className="flex min-w-0 flex-col border-b border-slate-300 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Datos de la afectación
            </div>
            <table className={`${spreadsheet.table} table-fixed border-0`}>
              <tbody>
                <tr>
                  <td className={`${fieldLabel} w-32`}>Número</td>
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
                  <td className={`${fieldLabel} w-32`}>Fecha</td>
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
                  <td className={`${fieldLabel} w-32 align-top`}>Expediente</td>
                  <td className={`${fieldValue} overflow-visible`}>
                    <ExpedienteCombobox
                      value={expediente}
                      onChange={handleExpedienteChange}
                      options={expedientes}
                      loading={loadingExpedientes}
                      variant="cell"
                      onCreateRequest={() => setNuevoExpedienteOpen(true)}
                    />
                  </td>
                </tr>
                <tr>
                  <td className={`${fieldLabel} w-32 align-top`}>Destinatario</td>
                  <td className={`${fieldValue} overflow-visible`}>
                    {multiProveedores ? (
                      <DestinatarioProveedoresField
                        options={expedienteProveedores}
                        selectedIds={destinatarioIds}
                        focusRef={destinatarioFocusRef}
                        onChange={(ids, destinatario) => {
                          setDestinatarioIds(ids);
                          setForm((prev) => ({ ...prev, destinatario }));
                        }}
                        variant="cell"
                      />
                    ) : (
                      <input
                        value={form.destinatario}
                        onChange={(e) => setForm({ ...form, destinatario: e.target.value })}
                        required
                        className={cellInput}
                      />
                    )}
                  </td>
                </tr>
                <tr>
                  <td className={`${fieldLabel} w-32`}>Importe</td>
                  <td className={fieldValue}>
                    <ImporteInput
                      value={form.importe}
                      onChange={(next) => {
                        setForm({ ...form, importe: next });
                        if (detalle.length === 1) {
                          setDetalle([{ ...detalle[0], importe: next }]);
                        }
                      }}
                      required
                      placeholder="0,00"
                      className={`${cellInput} text-base font-semibold`}
                    />
                  </td>
                </tr>
                <tr>
                  <td className={`${fieldLabel} w-32`}>Nº comprobante</td>
                  <td className={fieldValue}>
                    <input
                      value={form.numeroComprobante}
                      onChange={(e) =>
                        setForm({ ...form, numeroComprobante: e.target.value })
                      }
                      placeholder="Opcional (factura, remito, etc.)"
                      maxLength={100}
                      className={cellInput}
                    />
                  </td>
                </tr>
                <tr>
                  <td className={`${fieldLabel} w-32 align-top`}>Observaciones</td>
                  <td className={fieldValue}>
                    <textarea
                      value={form.observaciones}
                      onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                      rows={3}
                      placeholder="Detalle / nota de esta afectación (opcional)"
                      className="w-full min-w-0 resize-none rounded-none border-0 bg-transparent px-2 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500/40"
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            {expediente ? (
              <div className="mt-auto space-y-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    Exp.{' '}
                    <strong className="font-mono text-slate-800">{expediente.numero_completo}</strong>
                  </span>
                  <span>Total {formatCurrency(expediente.importe)}</span>
                  <span>Afectado {formatCurrency(expediente.importe_afectado)}</span>
                  <span
                    className={
                      expediente.importe_disponible > 0
                        ? 'font-semibold text-emerald-700'
                        : 'font-semibold text-amber-700'
                    }
                  >
                    Disp. {formatCurrency(expediente.importe_disponible)}
                  </span>
                </div>
                {quedaDisponibleEnExpediente && (
                  <p className="text-[11px] text-amber-800">
                    Con esta afectación ({formatCurrency(importeDetalle)}) quedará disponible{' '}
                    <strong className="font-mono">{formatCurrency(remanenteExpediente)}</strong> para
                    registrar más afectaciones sobre el mismo expediente.
                  </p>
                )}
                <div className="flex items-center justify-between gap-2 border-t border-slate-200/80 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Afectaciones previas
                  </p>
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                    {expediente.afectaciones_activas} activa
                    {expediente.afectaciones_activas !== 1 ? 's' : ''}
                  </span>
                </div>
                {expediente.importe_disponible <= 0 && (
                  <p className="text-[11px] text-amber-700">
                    Este expediente no tiene saldo disponible para nuevas afectaciones.
                  </p>
                )}
                {expediente.afectaciones && expediente.afectaciones.length > 0 ? (
                  <ul className="max-h-32 space-y-1.5 overflow-y-auto">
                    {expediente.afectaciones.map((a) => (
                      <li
                        key={a.id}
                        className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-600"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-mono font-semibold text-slate-800">
                            {a.numero_completo}
                          </span>
                          <span className="tabular-nums font-medium text-slate-700">
                            {formatCurrency(a.importe_total)}
                          </span>
                        </div>
                        {a.numero_comprobante ? (
                          <p className="mt-0.5 font-mono text-slate-500">
                            Comp. {a.numero_comprobante}
                          </p>
                        ) : null}
                        {a.observaciones ? (
                          <p className="mt-0.5 text-slate-500">{a.observaciones}</p>
                        ) : !a.numero_comprobante ? (
                          <p className="mt-0.5 italic text-slate-400">Sin observaciones</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Todavía no tiene afectaciones. Esta será la primera.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-auto border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                Seleccioná un expediente para ver saldos y afectaciones previas.
              </div>
            )}
          </div>

          {/* Derecha: detalle de cuentas (más ancha) */}
          <div className="flex min-h-70 min-w-0 flex-col">
            <div className="border-b border-slate-300 bg-slate-100 px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Detalle de cuentas
              </span>
            </div>

            <div className="flex-1 divide-y divide-slate-200">
              <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,1fr)_2.5rem] bg-[#e8eef4] text-[11px] font-semibold uppercase tracking-wide text-slate-600 sm:grid">
                <div className="px-3 py-1.5">Cuenta</div>
                <div className="px-3 py-1.5">Descripción</div>
                <div className="px-3 py-1.5 text-right">Importe</div>
                <div />
              </div>
              {detalle.map((line, index) => {
                const excludeIds = detalle
                  .map((l, i) => (i !== index && l.cuenta ? l.cuenta.id : null))
                  .filter((id): id is number => id !== null);

                return (
                  <div
                    key={line.key}
                    className="grid gap-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0 border-r border-slate-200">
                      <CuentaCombobox
                        value={line.cuenta}
                        onChange={(cuenta) => {
                          updateLine(index, {
                            cuenta,
                            descripcion:
                              line.descripcion.trim() ||
                              cuenta?.descripcion ||
                              '',
                          });
                        }}
                        options={cuentas}
                        loading={loadingCuentas}
                        excludeIds={excludeIds}
                        variant="cell"
                        placeholder="Buscar cuenta..."
                        autoFocus={focusCuenta?.index === index}
                        autoFocusKey={focusCuenta?.index === index ? focusCuenta.token : undefined}
                      />
                    </div>
                    <input
                      value={line.descripcion}
                      onChange={(e) => updateLine(index, { descripcion: e.target.value })}
                      placeholder="Opcional"
                      className={cellInput}
                    />
                    <ImporteInput
                      value={line.importe}
                      onChange={(importe) => updateLine(index, { importe })}
                      placeholder="0,00"
                      className={cellInput}
                      required
                    />
                    {detalle.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="flex items-center justify-center border-l border-slate-200 px-3 text-red-500 hover:bg-red-50"
                        title="Quitar línea"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <div className="border-l border-slate-200" />
                    )}
                  </div>
                );
              })}

              {/* Fila para agregar otra cuenta: clic = nueva línea + foco en búsqueda */}
              <button
                type="button"
                onClick={addCuentaLine}
                className="grid w-full grid-cols-1 text-left transition hover:bg-primary-50/60 focus-visible:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/40 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,1fr)_auto]"
              >
                <div className="flex min-h-9 items-center gap-2 border-r border-transparent px-3 py-1.5 text-sm text-slate-400 sm:border-slate-100">
                  <Plus size={15} className="shrink-0 text-primary-500" />
                  <span>Agregar otra cuenta...</span>
                </div>
                <div className="hidden border-r border-transparent sm:block" />
                <div className="hidden sm:block" />
                <div className="hidden border-l border-transparent sm:block" />
              </button>
            </div>

            <div className="mt-auto border-t border-slate-200 bg-[#f1f5f9] px-4 py-2.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-600">
                  Asignado en cuentas:{' '}
                  <strong className="font-mono text-primary-800">
                    {formatCurrency(importeDetalle)}
                  </strong>
                </span>
                <span
                  className={
                    totalCompleto
                      ? 'font-medium text-emerald-700'
                      : importeAfectacion > 0
                        ? 'font-medium text-amber-700'
                        : 'text-slate-500'
                  }
                >
                  {importeAfectacion <= 0
                    ? 'Indicá el importe a la izquierda'
                    : totalCompleto
                      ? 'Total completo ✓'
                      : `Falta ${formatCurrency(Math.abs(diferencia))} ${diferencia > 0 ? 'por asignar' : 'de más'}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        <SpreadsheetFormFooter
          info={
            <span className="space-x-2">
              <span>
                Cuentas:{' '}
                <strong className="font-mono text-primary-800">
                  {formatCurrency(importeDetalle)}
                </strong>
              </span>
              <span className="text-slate-400">|</span>
              <span>
                Importe:{' '}
                <strong className="font-mono">{formatCurrency(importeAfectacion)}</strong>
              </span>
              {expediente && (
                <>
                  <span className="text-slate-400">|</span>
                  <span>
                    Disp. exp.:{' '}
                    <strong className="font-mono">{formatCurrency(expediente.importe_disponible)}</strong>
                  </span>
                  {quedaDisponibleEnExpediente && (
                    <>
                      <span className="text-slate-400">|</span>
                      <span className="text-amber-700">
                        Quedará{' '}
                        <strong className="font-mono">{formatCurrency(remanenteExpediente)}</strong>
                      </span>
                    </>
                  )}
                </>
              )}
            </span>
          }
        >
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={createMutation.isPending} disabled={!canSubmit}>
            Confirmar afectación
          </Button>
        </SpreadsheetFormFooter>
      </form>
    </Modal>

      <Modal
        open={confirmPartialOpen}
        onClose={() => setConfirmPartialOpen(false)}
        title="Confirmar afectación parcial"
        size="sm"
        stackLevel={1}
      >
        <div className="space-y-3 text-sm text-slate-600">
          {importeIncompleto ? (
            <p>
              No se completó el total del importe indicado. Las cuentas suman menos de lo
              declarado.
            </p>
          ) : (
            <p>
              No se está afectando el <strong>total disponible</strong> del expediente{' '}
              <strong className="font-mono">{expediente?.numero_completo}</strong>.
            </p>
          )}
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-950">
            {importeIncompleto && (
              <>
                <p>
                  Importe indicado:{' '}
                  <strong className="font-mono tabular-nums">
                    {formatCurrency(importeAfectacion)}
                  </strong>
                </p>
                <p>
                  Asignado en cuentas:{' '}
                  <strong className="font-mono tabular-nums">
                    {formatCurrency(importeDetalle)}
                  </strong>
                </p>
                <p>
                  Falta por asignar:{' '}
                  <strong className="font-mono tabular-nums">{formatCurrency(diferencia)}</strong>
                </p>
              </>
            )}
            <p className={importeIncompleto ? 'mt-1.5 border-t border-amber-200/80 pt-1.5' : ''}>
              Se registrará la afectación por{' '}
              <strong className="font-mono tabular-nums">{formatCurrency(importeDetalle)}</strong>
              {quedaDisponibleEnExpediente && (
                <>
                  {' '}
                  y quedará disponible{' '}
                  <strong className="font-mono tabular-nums">
                    {formatCurrency(remanenteExpediente)}
                  </strong>{' '}
                  en el expediente
                </>
              )}
              .
            </p>
          </div>
          <p>
            Podrá registrar <strong>más afectaciones</strong> sobre el mismo expediente con el
            saldo restante. ¿Desea continuar?
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmPartialOpen(false)}>
            Revisar
          </Button>
          <Button loading={createMutation.isPending} onClick={confirmPartialAndCreate}>
            Continuar y crear
          </Button>
        </div>
      </Modal>

      <NuevoExpedienteModal
        open={nuevoExpedienteOpen}
        onClose={() => setNuevoExpedienteOpen(false)}
        onCreated={handleExpedienteCreated}
        stackLevel={1}
      />
    </>
  );
}
