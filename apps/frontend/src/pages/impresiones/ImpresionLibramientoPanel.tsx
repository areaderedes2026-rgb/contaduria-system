import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Printer,
  Save,
  RotateCcw,
  Upload,
  Trash2,
  Eye,
  Download,
  Crosshair,
  Grid3x3,
  MousePointer2,
} from 'lucide-react';
import {
  LibramientoPrintSheet,
  sampleLibramientoPrintData,
  isDetalleColKey,
  isLibramientoColKey,
  LIBRAMIENTO_EDITABLE_LABELS,
  type LibramientoEditableId,
  type LibramientoFieldKey,
} from '@/components/impresion/LibramientoPrintSheet';
import {
  DEFAULT_IMPRESION_LIBRAMIENTO,
  getImpresionLibramientoConfig,
  updateImpresionLibramientoConfig,
  type ImpresionLibramientoCampos,
  type ImpresionLibramientoConfig,
  type PrintFieldPos,
} from '@/services/configuracion.service';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SpreadsheetFormError } from '@/components/spreadsheet';
import { useAuthStore } from '@/stores/authStore';
import { ApiClientError } from '@/services/api';
import { enqueuePrintJob } from '@/lib/printQueue';
import { renderLibramientoPdf } from '@/lib/libramientoPdf';

const fieldClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';
const numClass =
  'w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm tabular-nums text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-slate-100 pt-4">
      <div className="mb-3 text-sm font-semibold text-slate-800">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

type FieldKey = LibramientoFieldKey;

const FIELD_GROUPS: { title: string; keys: { key: FieldKey; label: string }[] }[] = [
  {
    title: 'Encabezado',
    keys: [
      { key: 'numero', label: 'Número (Nº)' },
      { key: 'son', label: 'Son (importe numérico)' },
      { key: 'fechaDia', label: 'Fecha — día' },
      { key: 'fechaMes', label: 'Fecha — mes' },
      { key: 'fechaAnio', label: 'Fecha — año' },
    ],
  },
  {
    title: 'Beneficiario e importes',
    keys: [
      { key: 'beneficiario', label: 'Beneficiario (Páguese a…)' },
      { key: 'importeLetras', label: 'Importe en letras' },
      { key: 'concepto', label: 'Concepto (por…)' },
    ],
  },
  {
    title: 'Referencias',
    keys: [
      { key: 'nCheque', label: 'Nº de Cheque' },
      { key: 'nDecreto', label: 'Nº Dec. / Resol.' },
      { key: 'nExpediente', label: 'Nº de Expediente' },
    ],
  },
  {
    title: 'Totales',
    keys: [
      { key: 'total', label: 'Total $' },
      { key: 'retencionesTotal', label: 'Retenciones o deducciones $' },
      { key: 'liquido', label: 'Líquido a pagar $' },
    ],
  },
  {
    title: 'Recibo (pie)',
    keys: [
      { key: 'reciboImporteLetras', label: 'Recibo — importe letras' },
      { key: 'reciboConcepto', label: 'Recibo — concepto' },
      { key: 'reciboDia', label: 'Recibo — día' },
      { key: 'reciboMes', label: 'Recibo — mes' },
      { key: 'reciboAnio', label: 'Recibo — año' },
    ],
  },
];

function PosEditor({
  label,
  pos,
  disabled,
  selected,
  open,
  fieldKey,
  onChange,
}: {
  label: string;
  pos: PrintFieldPos;
  disabled?: boolean;
  selected?: boolean;
  open?: boolean;
  fieldKey: string;
  onChange: (next: PrintFieldPos) => void;
}) {
  const patch = <K extends keyof PrintFieldPos>(key: K, value: PrintFieldPos[K]) => {
    onChange({ ...pos, [key]: value });
  };

  return (
    <details
      id={`pos-editor-${fieldKey}`}
      open={open || selected}
      className={`rounded-md border bg-slate-50/80 open:bg-white ${
        selected ? 'border-primary-500 ring-2 ring-primary-500/25' : 'border-slate-200'
      }`}
    >
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-slate-700">
        {label}
        <span className="ml-2 font-normal tabular-nums text-slate-400">
          x {pos.xMm} · y {pos.yMm}
          {pos.visible === false ? ' · oculto' : ''}
        </span>
      </summary>
      <div className="grid gap-2 border-t border-slate-100 p-3 sm:grid-cols-3">
        <Field label="X (mm)">
          <input
            type="number"
            step={0.1}
            className={numClass}
            value={pos.xMm}
            disabled={disabled}
            onChange={(e) => patch('xMm', Number(e.target.value))}
          />
        </Field>
        <Field label="Y (mm)">
          <input
            type="number"
            step={0.1}
            className={numClass}
            value={pos.yMm}
            disabled={disabled}
            onChange={(e) => patch('yMm', Number(e.target.value))}
          />
        </Field>
        <Field label="Ancho (mm)">
          <input
            type="number"
            step={0.1}
            className={numClass}
            value={pos.widthMm ?? ''}
            disabled={disabled}
            placeholder="auto"
            onChange={(e) =>
              patch('widthMm', e.target.value === '' ? undefined : Number(e.target.value))
            }
          />
        </Field>
        <Field label="Alto (mm)">
          <input
            type="number"
            step={0.1}
            className={numClass}
            value={pos.heightMm ?? ''}
            disabled={disabled}
            placeholder="auto"
            onChange={(e) =>
              patch('heightMm', e.target.value === '' ? undefined : Number(e.target.value))
            }
          />
        </Field>
        <Field label="Fuente (pt)">
          <input
            type="number"
            step={0.5}
            min={5}
            max={28}
            className={numClass}
            value={pos.fontSizePt ?? ''}
            disabled={disabled}
            placeholder="base"
            onChange={(e) =>
              patch('fontSizePt', e.target.value === '' ? undefined : Number(e.target.value))
            }
          />
        </Field>
        <Field label="Alineación">
          <select
            className={numClass}
            value={pos.align ?? 'left'}
            disabled={disabled}
            onChange={(e) => patch('align', e.target.value as PrintFieldPos['align'])}
          >
            <option value="left">Izquierda</option>
            <option value="center">Centro</option>
            <option value="right">Derecha</option>
          </select>
        </Field>
        <Field label="Espaciado letras">
          <input
            type="number"
            step={0.01}
            className={numClass}
            value={pos.letterSpacingEm ?? ''}
            disabled={disabled}
            placeholder="0"
            onChange={(e) =>
              patch(
                'letterSpacingEm',
                e.target.value === '' ? undefined : Number(e.target.value)
              )
            }
          />
        </Field>
        <label className="flex items-end gap-2 pb-1 text-sm text-slate-700 sm:col-span-2">
          <input
            type="checkbox"
            checked={pos.visible !== false}
            disabled={disabled}
            onChange={(e) => patch('visible', e.target.checked)}
            className="rounded border-border text-primary-600 focus:ring-primary-500"
          />
          Imprimir este campo
        </label>
      </div>
    </details>
  );
}

export function ImpresionLibramientoPanel() {
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission('configuracion:write'));
  const [draft, setDraft] = useState<ImpresionLibramientoConfig | null>(null);
  const [formError, setFormError] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [resetModal, setResetModal] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.72);
  const [editOnSheet, setEditOnSheet] = useState(false);
  const [selectedId, setSelectedId] = useState<LibramientoEditableId | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['impresion-libramiento-config'],
    queryFn: getImpresionLibramientoConfig,
  });

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const sample = useMemo(() => sampleLibramientoPrintData(), []);

  const saveMutation = useMutation({
    mutationFn: (payload: ImpresionLibramientoConfig) =>
      updateImpresionLibramientoConfig(payload),
    onSuccess: (saved) => {
      setDraft(saved);
      setFormError('');
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2500);
      queryClient.setQueryData(['impresion-libramiento-config'], saved);
      queryClient.invalidateQueries({ queryKey: ['impresion-libramiento-config'] });
    },
    onError: (err) => {
      setFormError(
        err instanceof ApiClientError ? err.message : 'Error al guardar la calibración'
      );
    },
  });

  const isDirty = useMemo(() => {
    if (!draft || !data) return false;
    return JSON.stringify(draft) !== JSON.stringify(data);
  }, [draft, data]);

  const patch = <K extends keyof ImpresionLibramientoConfig>(
    key: K,
    value: ImpresionLibramientoConfig[K]
  ) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const patchCampo = <K extends keyof ImpresionLibramientoCampos>(
    key: K,
    value: ImpresionLibramientoCampos[K]
  ) => {
    setDraft((prev) =>
      prev ? { ...prev, campos: { ...prev.campos, [key]: value } } : prev
    );
  };

  const patchFieldPos = (key: FieldKey, value: PrintFieldPos) => {
    patchCampo(key, value);
  };

  const handleSelectId = (id: LibramientoEditableId | null) => {
    setSelectedId(id);
    if (!id || isLibramientoColKey(id)) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`pos-editor-${id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });
  };

  const handleMoveId = (id: LibramientoEditableId, xMm: number, yMm: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const campos = { ...prev.campos };
      if (isLibramientoColKey(id)) {
        campos[id] = { ...campos[id], xMm };
        if (isDetalleColKey(id)) {
          campos.detalleInicioYMm = yMm;
        } else {
          campos.retencionesInicioYMm = yMm;
        }
      } else {
        campos[id] = { ...campos[id], xMm, yMm };
      }
      return { ...prev, campos };
    });
  };

  const handleGuiaUpload = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('El archivo debe ser una imagen (PNG, JPG o WEBP)');
      return;
    }
    if (file.size > 4_000_000) {
      setFormError('La imagen guía no debe superar 4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setFormError('No se pudo leer la imagen guía');
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (!result || !result.startsWith('data:image/')) {
        setFormError('El archivo no se reconoció como imagen válida');
        return;
      }
      setFormError('');
      setDraft((prev) =>
        prev ? { ...prev, guiaDataUrl: result, mostrarGuiaEnPreview: true } : prev
      );
    };
    reader.readAsDataURL(file);
  };

  const handlePrintPreview = () => {
    if (!draft) return;
    enqueuePrintJob({
      tipo: 'libramiento',
      libramiento: sample,
      config: { ...draft, mostrarGuiaEnPreview: false },
    });
  };

  const handlePdfPreview = async (withGuia: boolean) => {
    if (!draft) return;
    setPdfBusy(true);
    setFormError('');
    try {
      await renderLibramientoPdf(sample, draft, { forceGuia: withGuia });
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'No se pudo generar el PDF de prueba'
      );
    } finally {
      setPdfBusy(false);
    }
  };

  if (isLoading || !draft) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        Cargando calibración de libramientos...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error instanceof ApiClientError
          ? error.message
          : 'No se pudo cargar la calibración de libramientos'}
      </div>
    );
  }

  const c = draft.campos;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-slate-600">
          Overlay sobre formulario preimpreso A4. Solo se imprimen los valores; calibrá cada
          campo en milímetros hasta coincidir con la hoja continua.
        </p>
        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            {savedFlash && (
              <span className="text-sm font-medium text-emerald-700">Guardado</span>
            )}
            {isDirty && (
              <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                Cambios sin guardar
              </span>
            )}
            <Button type="button" variant="secondary" size="sm" onClick={() => setResetModal(true)}>
              <RotateCcw size={14} /> Restablecer
            </Button>
            <Button
              type="button"
              size="sm"
              loading={saveMutation.isPending}
              disabled={!isDirty}
              onClick={() => saveMutation.mutate(draft)}
            >
              <Save size={14} /> Guardar calibración
            </Button>
          </div>
        )}
      </div>

      {formError && <SpreadsheetFormError>{formError}</SpreadsheetFormError>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="max-h-[calc(100dvh-12rem)] space-y-4 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Crosshair size={16} className="text-primary-700" />
            Ajuste global
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Offset X global (mm)" hint="Mueve todos los campos a la vez">
              <input
                type="number"
                step={0.1}
                className={fieldClass}
                value={draft.offsetXMm}
                disabled={!canWrite}
                onChange={(e) => patch('offsetXMm', Number(e.target.value))}
              />
            </Field>
            <Field label="Offset Y global (mm)">
              <input
                type="number"
                step={0.1}
                className={fieldClass}
                value={draft.offsetYMm}
                disabled={!canWrite}
                onChange={(e) => patch('offsetYMm', Number(e.target.value))}
              />
            </Field>
            <Field label="Escala" hint="0.85 – 1.15">
              <input
                type="number"
                step={0.01}
                min={0.85}
                max={1.15}
                className={fieldClass}
                value={draft.escala}
                disabled={!canWrite}
                onChange={(e) => patch('escala', Number(e.target.value))}
              />
            </Field>
            <Field label="Tamaño base (pt)">
              <input
                type="number"
                step={0.5}
                min={7}
                max={16}
                className={fieldClass}
                value={draft.tamanoFuenteBasePt}
                disabled={!canWrite}
                onChange={(e) => patch('tamanoFuenteBasePt', Number(e.target.value))}
              />
            </Field>
            <Field label="Fuente">
              <input
                className={fieldClass}
                value={draft.fuente}
                disabled={!canWrite}
                onChange={(e) => patch('fuente', e.target.value)}
              />
            </Field>
            <Field label="Color texto">
              <input
                type="color"
                className="h-10 w-full cursor-pointer rounded-md border border-slate-300 bg-white p-1"
                value={draft.colorTexto}
                disabled={!canWrite}
                onChange={(e) => patch('colorTexto', e.target.value)}
              />
            </Field>
          </div>

          <Section title="Formato de datos">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Formato de número">
                <select
                  className={fieldClass}
                  value={draft.usarNumeroCompleto ? 'completo' : 'padded'}
                  disabled={!canWrite}
                  onChange={(e) => patch('usarNumeroCompleto', e.target.value === 'completo')}
                >
                  <option value="completo">Número y año (ej. 12/2026)</option>
                  <option value="padded">Solo número con ceros</option>
                </select>
              </Field>
              {!draft.usarNumeroCompleto && (
                <Field label="Dígitos (padding)">
                  <input
                    type="number"
                    min={0}
                    max={12}
                    className={fieldClass}
                    value={draft.paddingNumero}
                    disabled={!canWrite}
                    onChange={(e) => patch('paddingNumero', Number(e.target.value) || 0)}
                  />
                </Field>
              )}
              <Field label="Formato importe">
                <select
                  className={fieldClass}
                  value={draft.formatoImporte}
                  disabled={!canWrite}
                  onChange={(e) =>
                    patch(
                      'formatoImporte',
                      e.target.value as ImpresionLibramientoConfig['formatoImporte']
                    )
                  }
                >
                  <option value="sin_simbolo">1.234,56</option>
                  <option value="con_simbolo">$ 1.234,56</option>
                  <option value="solo_numero">1234.56</option>
                </select>
              </Field>
              <Field label="Decimales">
                <select
                  className={fieldClass}
                  value={draft.decimalesImporte}
                  disabled={!canWrite}
                  onChange={(e) => patch('decimalesImporte', Number(e.target.value))}
                >
                  <option value={0}>0</option>
                  <option value={2}>2</option>
                </select>
              </Field>
              <Field label="Concepto desde">
                <select
                  className={fieldClass}
                  value={draft.conceptoFuente}
                  disabled={!canWrite}
                  onChange={(e) =>
                    patch(
                      'conceptoFuente',
                      e.target.value as ImpresionLibramientoConfig['conceptoFuente']
                    )
                  }
                >
                  <option value="observaciones">Observaciones del libramiento</option>
                  <option value="fijo">Texto fijo</option>
                  <option value="vacio">Vacío (llenar a mano)</option>
                </select>
              </Field>
              {draft.conceptoFuente === 'fijo' && (
                <Field label="Concepto fijo">
                  <input
                    className={fieldClass}
                    value={draft.conceptoFijo}
                    disabled={!canWrite}
                    onChange={(e) => patch('conceptoFijo', e.target.value)}
                  />
                </Field>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.mostrarImporteLetras}
                disabled={!canWrite}
                onChange={(e) => patch('mostrarImporteLetras', e.target.checked)}
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              Imprimir importe en letras
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.importeLetrasMayusculas}
                disabled={!canWrite || !draft.mostrarImporteLetras}
                onChange={(e) => patch('importeLetrasMayusculas', e.target.checked)}
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              Importe en letras en mayúsculas
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.anioFechaDosDigitos}
                disabled={!canWrite}
                onChange={(e) => patch('anioFechaDosDigitos', e.target.checked)}
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              Año en cajas con 2 dígitos
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.mesReciboEnLetras}
                disabled={!canWrite}
                onChange={(e) => patch('mesReciboEnLetras', e.target.checked)}
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              Mes del recibo en letras (enero, febrero…)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.imprimirSeccionRecibo}
                disabled={!canWrite}
                onChange={(e) => patch('imprimirSeccionRecibo', e.target.checked)}
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              Imprimir sección Recibí
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.imprimirRetencionesLineas}
                disabled={!canWrite}
                onChange={(e) => patch('imprimirRetencionesLineas', e.target.checked)}
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              Imprimir líneas de retenciones (1–4)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.imprimirNCheque}
                disabled={!canWrite}
                onChange={(e) => patch('imprimirNCheque', e.target.checked)}
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              Imprimir Nº de cheque (si existe en datos)
            </label>
          </Section>

          <Section title="Guía y herramientas de calibración">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.mostrarGuiaEnPreview}
                disabled={!canWrite}
                onChange={(e) => patch('mostrarGuiaEnPreview', e.target.checked)}
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              Mostrar imagen guía en vista previa
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.mostrarRejilla}
                disabled={!canWrite}
                onChange={(e) => patch('mostrarRejilla', e.target.checked)}
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              <Grid3x3 size={14} /> Mostrar rejilla (mm)
            </label>
            {draft.mostrarRejilla && (
              <Field label="Paso de rejilla (mm)">
                <input
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  className={fieldClass}
                  value={draft.rejillaPasoMm}
                  disabled={!canWrite}
                  onChange={(e) => patch('rejillaPasoMm', Number(e.target.value) || 5)}
                />
              </Field>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.mostrarNombresCamposPreview}
                disabled={!canWrite}
                onChange={(e) => patch('mostrarNombresCamposPreview', e.target.checked)}
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              Mostrar nombres de campos en preview
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.incluirGuiaEnPdf}
                disabled={!canWrite}
                onChange={(e) => patch('incluirGuiaEnPdf', e.target.checked)}
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              Incluir guía en PDF de prueba (no usar al imprimir real)
            </label>

            {canWrite && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <Upload size={14} />
                  Subir foto del formulario
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      handleGuiaUpload(e.target.files?.[0] ?? null);
                      e.target.value = '';
                    }}
                  />
                </label>
                {draft.guiaDataUrl && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => patch('guiaDataUrl', null)}
                  >
                    <Trash2 size={14} /> Quitar guía
                  </Button>
                )}
              </div>
            )}
            {draft.guiaDataUrl ? (
              <p className="text-xs text-slate-500">
                Guía cargada. Usala de fondo para alinear cada campo al milímetro.
              </p>
            ) : (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Subí una foto escaneada del formulario en blanco (o con marcas) para calibrar
                con precisión.
              </p>
            )}
          </Section>

          <Section title="Tabla de cuentas (filas)">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Y primera fila (mm)">
                <input
                  type="number"
                  step={0.1}
                  className={fieldClass}
                  value={c.detalleInicioYMm}
                  disabled={!canWrite}
                  onChange={(e) => patchCampo('detalleInicioYMm', Number(e.target.value))}
                />
              </Field>
              <Field label="Alto fila (mm)">
                <input
                  type="number"
                  step={0.1}
                  className={fieldClass}
                  value={c.detalleAltoFilaMm}
                  disabled={!canWrite}
                  onChange={(e) => patchCampo('detalleAltoFilaMm', Number(e.target.value))}
                />
              </Field>
              <Field label="Máx. filas">
                <input
                  type="number"
                  min={1}
                  max={30}
                  className={fieldClass}
                  value={c.detalleMaxFilas}
                  disabled={!canWrite}
                  onChange={(e) =>
                    patchCampo('detalleMaxFilas', Number(e.target.value) || 1)
                  }
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ['detalleCodigo', 'Código X / ancho'],
                  ['detalleDenominacion', 'Denominación X / ancho'],
                  ['detalleImporte', 'Importe X / ancho'],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      step={0.1}
                      className={numClass}
                      value={c[key].xMm}
                      disabled={!canWrite}
                      onChange={(e) =>
                        patchCampo(key, { ...c[key], xMm: Number(e.target.value) })
                      }
                    />
                    <input
                      type="number"
                      step={0.1}
                      className={numClass}
                      value={c[key].widthMm ?? ''}
                      disabled={!canWrite}
                      onChange={(e) =>
                        patchCampo(key, {
                          ...c[key],
                          widthMm: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </Field>
              ))}
            </div>
          </Section>

          <Section title="Retenciones (líneas)">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Y primera línea (mm)">
                <input
                  type="number"
                  step={0.1}
                  className={fieldClass}
                  value={c.retencionesInicioYMm}
                  disabled={!canWrite}
                  onChange={(e) =>
                    patchCampo('retencionesInicioYMm', Number(e.target.value))
                  }
                />
              </Field>
              <Field label="Alto fila (mm)">
                <input
                  type="number"
                  step={0.1}
                  className={fieldClass}
                  value={c.retencionesAltoFilaMm}
                  disabled={!canWrite}
                  onChange={(e) =>
                    patchCampo('retencionesAltoFilaMm', Number(e.target.value))
                  }
                />
              </Field>
              <Field label="Máx. líneas">
                <input
                  type="number"
                  min={0}
                  max={8}
                  className={fieldClass}
                  value={c.retencionesMaxFilas}
                  disabled={!canWrite}
                  onChange={(e) =>
                    patchCampo('retencionesMaxFilas', Number(e.target.value) || 0)
                  }
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['retencionConcepto', 'Concepto X / ancho'],
                  ['retencionImporte', 'Importe X / ancho'],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      step={0.1}
                      className={numClass}
                      value={c[key].xMm}
                      disabled={!canWrite}
                      onChange={(e) =>
                        patchCampo(key, { ...c[key], xMm: Number(e.target.value) })
                      }
                    />
                    <input
                      type="number"
                      step={0.1}
                      className={numClass}
                      value={c[key].widthMm ?? ''}
                      disabled={!canWrite}
                      onChange={(e) =>
                        patchCampo(key, {
                          ...c[key],
                          widthMm: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </Field>
              ))}
            </div>
          </Section>

          <Section title="Posición campo por campo (mm)">
            {FIELD_GROUPS.map((group) => (
              <div key={group.title} className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {group.title}
                </div>
                {group.keys.map(({ key, label }) => (
                  <PosEditor
                    key={key}
                    fieldKey={key}
                    label={label}
                    pos={c[key]}
                    disabled={!canWrite}
                    selected={selectedId === key}
                    open={selectedId === key}
                    onChange={(next) => patchFieldPos(key, next)}
                  />
                ))}
              </div>
            ))}
          </Section>

          {!canWrite && (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Solo lectura. Se requiere permiso de configuración para editar la calibración.
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Eye size={16} className="text-primary-700" />
              Vista previa overlay (A4)
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canWrite && (
                <Button
                  type="button"
                  variant={editOnSheet ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    setEditOnSheet((v) => {
                      if (v) setSelectedId(null);
                      return !v;
                    });
                  }}
                  title="Activá para mover campos con el mouse y las flechas"
                >
                  <MousePointer2 size={14} />
                  {editOnSheet ? 'Editando en hoja' : 'Editar en hoja'}
                </Button>
              )}
              <label className="flex items-center gap-1 text-xs text-slate-500">
                Zoom
                <input
                  type="range"
                  min={0.4}
                  max={1}
                  step={0.05}
                  value={previewScale}
                  onChange={(e) => setPreviewScale(Number(e.target.value))}
                />
              </label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={pdfBusy}
                onClick={() => void handlePdfPreview(true)}
              >
                <Download size={14} /> PDF + guía
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={pdfBusy}
                onClick={() => void handlePdfPreview(false)}
              >
                <Download size={14} /> Probar PDF
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={handlePrintPreview}>
                <Printer size={14} /> Probar impresión
              </Button>
            </div>
          </div>

          {editOnSheet && (
            <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
              <strong className="font-semibold">Modo seguro de calibración.</strong> Clic en un
              campo → arrastrá. Flechas: 0,5 mm · Shift+flecha: 0,1 · Alt+flecha: 1 mm. Shift
              mientras arrastrás: bloquea eje. Ctrl: imán a la rejilla. Esc: deseleccionar. Los
              mm del panel se actualizan al instante; guardá para persistir.
              {selectedId && (
                <span className="mt-1 block font-medium">
                  Seleccionado: {LIBRAMIENTO_EDITABLE_LABELS[selectedId]}
                </span>
              )}
            </div>
          )}

          <div
            className={`overflow-auto rounded-lg border bg-slate-100/80 p-4 ${
              editOnSheet ? 'border-sky-400 ring-2 ring-sky-400/30' : 'border-slate-200'
            }`}
          >
            <div
              style={{
                width: `${210 * previewScale}mm`,
                height: `${297 * previewScale}mm`,
              }}
            >
              <div
                style={{
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top left',
                  width: '210mm',
                  height: '297mm',
                }}
              >
                <LibramientoPrintSheet
                  libramiento={sample}
                  config={draft}
                  preview
                  interactive={editOnSheet && canWrite}
                  selectedId={selectedId}
                  onSelectId={handleSelectId}
                  onMoveId={handleMoveId}
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Al imprimir un libramiento real solo salen los datos (sin guía ni controles de
            edición). Usá “Editar en hoja” para alinear a ojo y después guardá la calibración.
          </p>
        </div>
      </div>

      <Modal
        open={resetModal}
        onClose={() => setResetModal(false)}
        title="Restablecer calibración"
        size="sm"
      >
        <p className="mb-5 text-sm text-slate-600">
          Se restaurarán las coordenadas y opciones por defecto. Deberá guardar para
          aplicarlos en el sistema.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setResetModal(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              setDraft(structuredClone(DEFAULT_IMPRESION_LIBRAMIENTO));
              setResetModal(false);
            }}
          >
            Restablecer
          </Button>
        </div>
      </Modal>
    </div>
  );
}
