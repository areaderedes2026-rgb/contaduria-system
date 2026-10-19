import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { LibramientoPagoCombobox } from '@/components/pagos/LibramientoPagoCombobox';
import {
  SpreadsheetFormError,
  SpreadsheetFormFooter,
  cellInput,
  cellSelect,
  spreadsheet,
} from '@/components/spreadsheet';
import {
  createPago,
  getLibramientoParaPago,
  getLibramientosPendientesPago,
  getSiguienteNumeroPago,
  MEDIO_PAGO_LABELS,
} from '@/services/pagos.service';
import { ApiClientError } from '@/services/api';
import { formatCurrency, formatDate, formatPagoNumero } from '@/utils/format';
import { importeEnLetras } from '@/utils/importeEnLetras';
import type { LibramientoPendientePago, MedioPago, Pago } from '@/types';

const today = new Date().toISOString().slice(0, 10);

const fieldLabel = `${spreadsheet.headerCell} bg-[#e8eef4] font-semibold text-slate-700`;
const fieldValue = 'border border-slate-300 bg-white px-2 py-1.5 align-middle';

const medioOptions = (Object.keys(MEDIO_PAGO_LABELS) as MedioPago[]).map((k) => ({
  value: k,
  label: MEDIO_PAGO_LABELS[k],
}));

interface FormState {
  numero: string;
  fechaPago: string;
  medioPago: MedioPago;
  monto: string;
  numeroComprobante: string;
  banco: string;
  observaciones: string;
}

const emptyForm = (): FormState => ({
  numero: '',
  fechaPago: today,
  medioPago: 'TRANSFERENCIA',
  monto: '',
  numeroComprobante: '',
  banco: '',
  observaciones: '',
});

function moneyText(value: number): string {
  return value.toFixed(2);
}

interface NuevoPagoModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (pago: Pago) => void;
  /** Prefill desde deep-link `/pagos?libramiento=` */
  initialLibramientoId?: number | null;
}

export function NuevoPagoModal({
  open,
  onClose,
  onCreated,
  initialLibramientoId = null,
}: NuevoPagoModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [libramientoOpt, setLibramientoOpt] = useState<LibramientoPendientePago | null>(null);
  const [formError, setFormError] = useState('');
  const [numeroManual, setNumeroManual] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [prefillDone, setPrefillDone] = useState(false);

  const anioForm = parseInt(form.fechaPago.split('-')[0], 10);

  const { data: siguienteNumero, isLoading: loadingNumero } = useQuery({
    queryKey: ['siguiente-numero-pago', anioForm],
    queryFn: () => getSiguienteNumeroPago(anioForm),
    enabled: open && !!form.fechaPago && Number.isFinite(anioForm),
  });

  const { data: pendientes = [], isFetching: loadingPendientes } = useQuery({
    queryKey: ['libramientos-pendientes-pago'],
    queryFn: getLibramientosPendientesPago,
    enabled: open,
  });

  const libramientoId = libramientoOpt?.id ?? null;

  const { data: libramientoDetalle } = useQuery({
    queryKey: ['libramiento-para-pago', libramientoId],
    queryFn: () => getLibramientoParaPago(libramientoId!),
    enabled: open && !!libramientoId,
  });

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setLibramientoOpt(null);
    setFormError('');
    setNumeroManual(false);
    setConfirmOpen(false);
    setPrefillDone(false);
  }, [open]);

  useEffect(() => {
    if (!open || numeroManual || !siguienteNumero) return;
    setForm((prev) => ({ ...prev, numero: String(siguienteNumero.siguiente) }));
  }, [open, numeroManual, siguienteNumero]);

  // Prefill desde deep-link
  useEffect(() => {
    if (!open || prefillDone || !initialLibramientoId || loadingPendientes) return;
    const found = pendientes.find((l) => l.id === initialLibramientoId) ?? null;
    if (found) {
      setLibramientoOpt(found);
      setPrefillDone(true);
      return;
    }
    setFormError(
      `El libramiento #${initialLibramientoId} no está disponible para pago (puede estar pagado o anulado).`
    );
    setPrefillDone(true);
  }, [open, prefillDone, initialLibramientoId, pendientes, loadingPendientes]);

  const resumen = useMemo(() => {
    const lib = libramientoDetalle;
    const opt = libramientoOpt;
    const neto = Number(lib?.neto ?? opt?.neto ?? 0);
    const montoPagado = Number(
      lib?.monto_pagado ?? opt?.monto_pagado ?? 0
    );
    const saldo = Number(
      lib?.saldo_pendiente ??
        opt?.saldo_pendiente ??
        Math.round((neto - montoPagado) * 100) / 100
    );
    return {
      beneficiario: lib?.beneficiario || opt?.beneficiario || '',
      expediente: lib?.expediente_numero || opt?.expediente_numero || '',
      afectacion: lib?.afectacion_numero || opt?.afectacion_numero || '',
      importe: Number(lib?.importe ?? opt?.importe ?? 0),
      retenciones: Number(lib?.retenciones ?? opt?.retenciones ?? 0),
      neto,
      montoPagado,
      saldo,
      decreto: lib?.numero_decreto ?? opt?.numero_decreto ?? null,
      observaciones: lib?.observaciones ?? opt?.observaciones ?? null,
      fecha: lib?.fecha || opt?.fecha || '',
    };
  }, [libramientoDetalle, libramientoOpt]);

  // Default monto = saldo pendiente al cambiar libramiento / al obtener detalle
  useEffect(() => {
    if (!libramientoId || !(resumen.saldo > 0)) return;
    setForm((prev) => ({ ...prev, monto: moneyText(resumen.saldo) }));
  }, [libramientoId, resumen.saldo]);

  const previewNumero =
    form.numero && anioForm
      ? formatPagoNumero(parseInt(form.numero, 10) || 0, anioForm)
      : '—';

  const montoParsed = parseFloat(form.monto.replace(',', '.'));
  const montoValido =
    Number.isFinite(montoParsed) && montoParsed > 0 && montoParsed - resumen.saldo <= 0.01;
  const esParcial =
    Number.isFinite(montoParsed) &&
    montoParsed > 0 &&
    (montoParsed < resumen.saldo - 0.01 || resumen.montoPagado > 0.01);

  const createMutation = useMutation({
    mutationFn: () =>
      createPago({
        fecha_pago: form.fechaPago,
        libramiento_id: libramientoId!,
        medio_pago: form.medioPago,
        monto: Math.round(montoParsed * 100) / 100,
        numero: form.numero ? parseInt(form.numero, 10) : undefined,
        anio: anioForm,
        numero_comprobante: form.numeroComprobante.trim() || undefined,
        banco: form.banco.trim() || undefined,
        observaciones: form.observaciones.trim() || undefined,
      }),
    onSuccess: (created) => {
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
      queryClient.invalidateQueries({ queryKey: ['pagos-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['siguiente-numero-pago'] });
      queryClient.invalidateQueries({ queryKey: ['libramientos'] });
      queryClient.invalidateQueries({ queryKey: ['libramiento'] });
      queryClient.invalidateQueries({ queryKey: ['libramientos-pendientes-pago'] });
      queryClient.invalidateQueries({ queryKey: ['libramiento-para-pago'] });
      queryClient.invalidateQueries({ queryKey: ['expedientes'] });
      queryClient.invalidateQueries({ queryKey: ['expediente'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      onCreated?.(created);
      onClose();
    },
    onError: (err) => {
      setConfirmOpen(false);
      setFormError(err instanceof ApiClientError ? err.message : 'Error al registrar el pago');
    },
  });

  const validateForm = (): string | null => {
    if (!libramientoId) return 'Seleccione un libramiento pendiente';
    if (!form.fechaPago) return 'Indique la fecha de pago';
    if (!form.numero || parseInt(form.numero, 10) <= 0) return 'Indique un número válido';
    if (!Number.isFinite(montoParsed) || montoParsed <= 0) {
      return 'Indique un monto de pago mayor a cero';
    }
    if (montoParsed - resumen.saldo > 0.01) {
      return `El monto no puede superar el saldo pendiente (${formatCurrency(resumen.saldo)})`;
    }
    if (resumen.saldo <= 0) return 'El libramiento no tiene saldo pendiente';
    return null;
  };

  const canSubmit =
    !!libramientoId &&
    !!form.fechaPago &&
    !!form.numero &&
    parseInt(form.numero, 10) > 0 &&
    montoValido &&
    pendientes.length > 0;

  const tryCreate = () => {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError('');
    setConfirmOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setFormError(validateForm() ?? 'Complete todos los campos obligatorios');
      return;
    }
    tryCreate();
  };

  const handleLibramientoChange = (lib: LibramientoPendientePago | null) => {
    setLibramientoOpt(lib);
    if (!lib) {
      setForm((prev) => ({ ...prev, monto: '' }));
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Registrar pago" size="2xl" flush>
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
              <p className="font-mono tabular-nums">{anioForm || '—'}</p>
            </div>
          </div>

          {formError && <SpreadsheetFormError>{formError}</SpreadsheetFormError>}

          {pendientes.length === 0 && !loadingPendientes && (
            <div className="border-b border-slate-200 px-4 py-3">
              <Alert type="info">No hay libramientos pendientes de pago.</Alert>
            </div>
          )}

          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(340px,1.1fr)_minmax(280px,0.9fr)]">
            <div className="flex min-w-0 flex-col border-b border-slate-300 lg:border-b-0 lg:border-r">
              <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Datos del pago
              </div>
              <table className={`${spreadsheet.table} table-fixed border-0`}>
                <tbody>
                  <tr>
                    <td className={`${fieldLabel} w-40`}>Número</td>
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
                    <td className={`${fieldLabel} w-40`}>Fecha de pago</td>
                    <td className={fieldValue}>
                      <input
                        type="date"
                        value={form.fechaPago}
                        onChange={(e) => {
                          setNumeroManual(false);
                          setForm({ ...form, fechaPago: e.target.value });
                        }}
                        required
                        className={cellInput}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className={`${fieldLabel} w-40`}>Libramiento</td>
                    <td className={`${fieldValue} overflow-visible`}>
                      <LibramientoPagoCombobox
                        value={libramientoOpt}
                        onChange={handleLibramientoChange}
                        options={pendientes}
                        loading={loadingPendientes}
                        variant="cell"
                        disabled={pendientes.length === 0}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className={`${fieldLabel} w-40`}>Monto a pagar *</td>
                    <td className={fieldValue}>
                      <div className="flex items-stretch gap-0">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={form.monto}
                          onChange={(e) => setForm({ ...form, monto: e.target.value })}
                          disabled={!libramientoId}
                          required
                          placeholder={
                            libramientoId
                              ? moneyText(resumen.saldo)
                              : 'Seleccione libramiento'
                          }
                          className={`${cellInput} font-mono tabular-nums`}
                        />
                        {libramientoId && resumen.saldo > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({ ...prev, monto: moneyText(resumen.saldo) }))
                            }
                            className="shrink-0 border-l border-slate-300 bg-slate-50 px-3 text-xs font-medium text-slate-600 hover:bg-slate-100"
                            title="Completar con el saldo pendiente"
                          >
                            Total
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className={`${fieldLabel} w-40`}>Medio de pago</td>
                    <td className={fieldValue}>
                      <select
                        value={form.medioPago}
                        onChange={(e) =>
                          setForm({ ...form, medioPago: e.target.value as MedioPago })
                        }
                        required
                        className={cellSelect}
                      >
                        {medioOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td className={`${fieldLabel} w-40`}>Nº comprobante</td>
                    <td className={fieldValue}>
                      <input
                        value={form.numeroComprobante}
                        onChange={(e) =>
                          setForm({ ...form, numeroComprobante: e.target.value })
                        }
                        placeholder="Opcional"
                        className={cellInput}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className={`${fieldLabel} w-40`}>Banco</td>
                    <td className={fieldValue}>
                      <input
                        value={form.banco}
                        onChange={(e) => setForm({ ...form, banco: e.target.value })}
                        placeholder="Opcional"
                        className={cellInput}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className={`${fieldLabel} w-40 align-top`}>Observaciones</td>
                    <td className={fieldValue}>
                      <textarea
                        value={form.observaciones}
                        onChange={(e) =>
                          setForm({ ...form, observaciones: e.target.value })
                        }
                        rows={3}
                        placeholder="Opcional"
                        className="w-full min-w-0 resize-none rounded-none border-0 bg-transparent px-2 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500/40"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex min-w-0 flex-col bg-[#f8fafc]">
              <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Resumen del libramiento
              </div>
              {libramientoOpt || libramientoDetalle ? (
                <div className="space-y-3 p-4">
                  <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3.5 py-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-emerald-800/80">
                      {esParcial ? 'Monto de este pago' : 'Saldo a pagar'}
                    </div>
                    <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">
                      {formatCurrency(
                        Number.isFinite(montoParsed) && montoParsed > 0
                          ? montoParsed
                          : resumen.saldo
                      )}
                    </div>
                    <p className="mt-2 text-[11px] leading-snug text-emerald-900/70">
                      {importeEnLetras(
                        Number.isFinite(montoParsed) && montoParsed > 0
                          ? montoParsed
                          : resumen.saldo
                      )}
                    </p>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-white px-3.5 py-3 text-sm">
                    <dl className="space-y-1.5">
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Beneficiario</dt>
                        <dd className="max-w-[60%] text-right font-medium text-slate-800">
                          {resumen.beneficiario || '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Expediente</dt>
                        <dd className="font-mono text-slate-800">{resumen.expediente || '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Afectación</dt>
                        <dd className="font-mono text-slate-800">{resumen.afectacion || '—'}</dd>
                      </div>
                      {resumen.fecha && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-slate-500">Fecha libramiento</dt>
                          <dd className="tabular-nums text-slate-800">
                            {formatDate(resumen.fecha)}
                          </dd>
                        </div>
                      )}
                      {resumen.decreto && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-slate-500">Decreto</dt>
                          <dd className="font-mono text-slate-800">{resumen.decreto}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-white px-3.5 py-3 text-sm">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Desglose
                    </div>
                    <div className="space-y-1.5 tabular-nums">
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">Bruto</span>
                        <span className="font-medium text-slate-800">
                          {formatCurrency(resumen.importe)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">− Retenciones</span>
                        <span className="font-medium text-amber-800">
                          {formatCurrency(resumen.retenciones)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3 border-t border-slate-100 pt-1.5">
                        <span className="font-semibold text-slate-700">= Neto</span>
                        <span className="font-bold text-emerald-700">
                          {formatCurrency(resumen.neto)}
                        </span>
                      </div>
                      {resumen.montoPagado > 0.01 && (
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500">Ya pagado</span>
                          <span className="font-medium text-sky-800">
                            {formatCurrency(resumen.montoPagado)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between gap-3">
                        <span className="font-semibold text-slate-700">Saldo pendiente</span>
                        <span className="font-bold text-amber-800">
                          {formatCurrency(resumen.saldo)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {esParcial && Number.isFinite(montoParsed) && montoParsed < resumen.saldo - 0.01 ? (
                      <>
                        Pago parcial: el libramiento seguirá con saldo pendiente y el expediente
                        permanecerá en estado <strong>Librado</strong> hasta completar el neto.
                      </>
                    ) : (
                      <>
                        Al confirmar, el libramiento quedará marcado como <strong>pagado</strong> y el
                        expediente pasará a estado <strong>Pagado</strong>.
                      </>
                    )}
                  </p>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500">
                  Seleccioná un libramiento pendiente para ver el resumen y el importe a pagar.
                </div>
              )}
            </div>
          </div>

          <SpreadsheetFormFooter
            info={
              libramientoOpt ? (
                <span>
                  {esParcial && Number.isFinite(montoParsed) && montoParsed < resumen.saldo - 0.01
                    ? 'Pago parcial: '
                    : 'A pagar: '}
                  <strong className="font-mono text-emerald-700">
                    {formatCurrency(
                      Number.isFinite(montoParsed) && montoParsed > 0
                        ? montoParsed
                        : resumen.saldo
                    )}
                  </strong>
                  {resumen.montoPagado > 0.01 && (
                    <span className="ml-2 text-slate-500">
                      (saldo {formatCurrency(resumen.saldo)})
                    </span>
                  )}
                </span>
              ) : undefined
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
              Confirmar pago
            </Button>
          </SpreadsheetFormFooter>
        </form>
      </Modal>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirmar registro de pago"
        size="sm"
      >
        <p className="mb-3 text-sm text-slate-600">
          Se registrará el pago <strong className="font-mono">{previewNumero}</strong> por{' '}
          <strong className="tabular-nums text-emerald-700">
            {formatCurrency(montoParsed)}
          </strong>{' '}
          ({MEDIO_PAGO_LABELS[form.medioPago]}) a favor de{' '}
          <strong>{resumen.beneficiario}</strong>.
        </p>
        <p className="mb-5 text-sm text-slate-600">
          {Number.isFinite(montoParsed) && montoParsed < resumen.saldo - 0.01 ? (
            <>
              Quedará un saldo pendiente de{' '}
              <strong className="tabular-nums">
                {formatCurrency(Math.round((resumen.saldo - montoParsed) * 100) / 100)}
              </strong>{' '}
              en el libramiento{' '}
              <span className="font-mono">{libramientoOpt?.numero_completo}</span>. El expediente
              seguirá en estado Librado.
            </>
          ) : (
            <>
              El libramiento <span className="font-mono">{libramientoOpt?.numero_completo}</span>{' '}
              quedará pagado y el expediente pasará a estado Pagado.
            </>
          )}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
            Volver
          </Button>
          <Button
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Sí, registrar pago
          </Button>
        </div>
      </Modal>
    </>
  );
}
