import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Crosshair,
  Download,
  Eye,
  Grid3x3,
  MousePointer2,
  Printer,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AfectacionPrintSheet,
  AFECTACION_EDITABLE_LABELS,
  sampleAfectacionPrintData,
  type AfectacionEditableId,
} from '@/components/impresion/AfectacionPrintSheet';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SpreadsheetFormError } from '@/components/spreadsheet';
import { enqueuePrintJob } from '@/lib/printQueue';
import { renderAfectacionPdf } from '@/lib/afectacionPdf';
import { ApiClientError } from '@/services/api';
import {
  DEFAULT_IMPRESION_AFECTACION,
  getImpresionAfectacionConfig,
  updateImpresionAfectacionConfig,
  type ImpresionAfectacionCampos,
  type ImpresionAfectacionConfig,
  type PrintFieldPos,
} from '@/services/configuracion.service';
import { useAuthStore } from '@/stores/authStore';

const fieldClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';
const numClass =
  'w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm tabular-nums text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';
const checkboxClass = 'rounded border-border text-primary-600 focus:ring-primary-500';

const EDITABLE_IDS = Object.keys(AFECTACION_EDITABLE_LABELS) as AfectacionEditableId[];

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

function PosEditor({
  label,
  pos,
  disabled,
  selected,
  fieldKey,
  onChange,
}: {
  label: string;
  pos: PrintFieldPos;
  disabled?: boolean;
  selected?: boolean;
  fieldKey: string;
  onChange: (next: PrintFieldPos) => void;
}) {
  const patch = <K extends keyof PrintFieldPos>(key: K, value: PrintFieldPos[K]) => {
    onChange({ ...pos, [key]: value });
  };

  return (
    <details
      id={`pos-editor-${fieldKey}`}
      open={selected}
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
            onChange={(event) => patch('xMm', Number(event.target.value))}
          />
        </Field>
        <Field label="Y (mm)">
          <input
            type="number"
            step={0.1}
            className={numClass}
            value={pos.yMm}
            disabled={disabled}
            onChange={(event) => patch('yMm', Number(event.target.value))}
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
            onChange={(event) =>
              patch('widthMm', event.target.value === '' ? undefined : Number(event.target.value))
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
            onChange={(event) =>
              patch('heightMm', event.target.value === '' ? undefined : Number(event.target.value))
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
            onChange={(event) =>
              patch(
                'fontSizePt',
                event.target.value === '' ? undefined : Number(event.target.value)
              )
            }
          />
        </Field>
        <Field label="Alineación">
          <select
            className={numClass}
            value={pos.align ?? 'left'}
            disabled={disabled}
            onChange={(event) => patch('align', event.target.value as PrintFieldPos['align'])}
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
            onChange={(event) =>
              patch(
                'letterSpacingEm',
                event.target.value === '' ? undefined : Number(event.target.value)
              )
            }
          />
        </Field>
        <label className="flex items-end gap-2 pb-1 text-sm text-slate-700 sm:col-span-2">
          <input
            type="checkbox"
            checked={pos.visible !== false}
            disabled={disabled}
            onChange={(event) => patch('visible', event.target.checked)}
            className={checkboxClass}
          />
          Imprimir este campo
        </label>
      </div>
    </details>
  );
}

export function ImpresionAfectacionPanel() {
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((state) => state.hasPermission('configuracion:write'));
  const [draft, setDraft] = useState<ImpresionAfectacionConfig | null>(null);
  const [formError, setFormError] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [resetModal, setResetModal] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.72);
  const [editOnSheet, setEditOnSheet] = useState(false);
  const [selectedId, setSelectedId] = useState<AfectacionEditableId | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['impresion-afectacion-config'],
    queryFn: getImpresionAfectacionConfig,
  });

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const sample = useMemo(() => sampleAfectacionPrintData(), []);

  const saveMutation = useMutation({
    mutationFn: (payload: ImpresionAfectacionConfig) =>
      updateImpresionAfectacionConfig(payload),
    onSuccess: (saved) => {
      setDraft(saved);
      setFormError('');
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2500);
      queryClient.setQueryData(['impresion-afectacion-config'], saved);
      queryClient.invalidateQueries({ queryKey: ['impresion-afectacion-config'] });
    },
    onError: (mutationError) => {
      setFormError(
        mutationError instanceof ApiClientError
          ? mutationError.message
          : 'Error al guardar la configuración de impresión'
      );
    },
  });

  const isDirty = useMemo(() => {
    if (!draft || !data) return false;
    return JSON.stringify(draft) !== JSON.stringify(data);
  }, [draft, data]);

  const patch = <K extends keyof ImpresionAfectacionConfig>(
    key: K,
    value: ImpresionAfectacionConfig[K]
  ) => {
    setDraft((previous) => (previous ? { ...previous, [key]: value } : previous));
  };

  const patchCampo = <K extends keyof ImpresionAfectacionCampos>(
    key: K,
    value: ImpresionAfectacionCampos[K]
  ) => {
    setDraft((previous) =>
      previous
        ? { ...previous, campos: { ...previous.campos, [key]: value } }
        : previous
    );
  };

  const handleSelectId = (id: AfectacionEditableId | null) => {
    setSelectedId(id);
    if (!id) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`pos-editor-${id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });
  };

  const handleMoveId = (id: AfectacionEditableId, xMm: number, yMm: number) => {
    setDraft((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        campos: {
          ...previous.campos,
          [id]: { ...previous.campos[id], xMm, yMm },
        },
      };
    });
  };

  const handleImageUpload = (
    file: File | null,
    target: 'logoDataUrl' | 'firmaSelloDataUrl',
    label: string
  ) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError(`El archivo de ${label} debe ser una imagen (PNG, JPG o WEBP).`);
      return;
    }
    if (file.size > 1_500_000) {
      setFormError(`La imagen de ${label} no debe superar 1,5 MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setFormError(`No se pudo leer la imagen de ${label}.`);
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (!result?.startsWith('data:image/')) {
        setFormError(`El archivo de ${label} no se reconoció como una imagen válida.`);
        return;
      }
      setFormError('');
      patch(target, result);
    };
    reader.readAsDataURL(file);
  };

  const handlePdfPreview = async () => {
    if (!draft) return;
    setPdfBusy(true);
    setFormError('');
    try {
      await renderAfectacionPdf(sample, draft);
    } catch (pdfError) {
      setFormError(
        pdfError instanceof Error ? pdfError.message : 'No se pudo generar el PDF de prueba'
      );
    } finally {
      setPdfBusy(false);
    }
  };

  const handlePrintPreview = () => {
    if (!draft) return;
    enqueuePrintJob({
      tipo: 'afectacion',
      afectacion: sample,
      config: draft,
    });
  };

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error instanceof ApiClientError
          ? error.message
          : 'No se pudo cargar la configuración de impresión de afectaciones'}
      </div>
    );
  }

  if (isLoading || !draft) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        Cargando configuración de impresión de afectaciones...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-slate-600">
          Configurá el diseño A4 de las afectaciones y ajustá cada campo en milímetros.
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
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setResetModal(true)}
            >
              <RotateCcw size={14} /> Restablecer
            </Button>
            <Button
              type="button"
              size="sm"
              loading={saveMutation.isPending}
              disabled={!isDirty}
              onClick={() => saveMutation.mutate(draft)}
            >
              <Save size={14} /> Guardar configuración
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
                onChange={(event) => patch('offsetXMm', Number(event.target.value))}
              />
            </Field>
            <Field label="Offset Y global (mm)">
              <input
                type="number"
                step={0.1}
                className={fieldClass}
                value={draft.offsetYMm}
                disabled={!canWrite}
                onChange={(event) => patch('offsetYMm', Number(event.target.value))}
              />
            </Field>
            <Field label="Escala" hint="0,85 – 1,15">
              <input
                type="number"
                step={0.01}
                min={0.85}
                max={1.15}
                className={fieldClass}
                value={draft.escala}
                disabled={!canWrite}
                onChange={(event) => patch('escala', Number(event.target.value))}
              />
            </Field>
            <Field label="Tamaño de fuente">
              <select
                className={fieldClass}
                value={draft.tamanoFuente}
                disabled={!canWrite}
                onChange={(event) =>
                  patch(
                    'tamanoFuente',
                    event.target.value as ImpresionAfectacionConfig['tamanoFuente']
                  )
                }
              >
                <option value="pequeno">Pequeño</option>
                <option value="normal">Normal</option>
                <option value="grande">Grande</option>
              </select>
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.mostrarRejilla}
              disabled={!canWrite}
              onChange={(event) => patch('mostrarRejilla', event.target.checked)}
              className={checkboxClass}
            />
            <Grid3x3 size={14} /> Mostrar rejilla
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
                onChange={(event) => patch('rejillaPasoMm', Number(event.target.value) || 5)}
              />
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.mostrarNombresCamposPreview}
              disabled={!canWrite}
              onChange={(event) =>
                patch('mostrarNombresCamposPreview', event.target.checked)
              }
              className={checkboxClass}
            />
            Mostrar nombres de campos en la vista previa
          </label>

          <Section title="Encabezado">
            <Field label="Organismo">
              <input
                className={fieldClass}
                value={draft.organismo}
                disabled={!canWrite}
                onChange={(event) => patch('organismo', event.target.value)}
              />
            </Field>
            <Field label="Título del documento">
              <input
                className={fieldClass}
                value={draft.tituloDocumento}
                disabled={!canWrite}
                onChange={(event) => patch('tituloDocumento', event.target.value)}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Etiqueta número">
                <input
                  className={fieldClass}
                  value={draft.etiquetaNumero}
                  disabled={!canWrite}
                  onChange={(event) => patch('etiquetaNumero', event.target.value)}
                />
              </Field>
              <Field label="Etiqueta expediente">
                <input
                  className={fieldClass}
                  value={draft.etiquetaExpediente}
                  disabled={!canWrite}
                  onChange={(event) => patch('etiquetaExpediente', event.target.value)}
                />
              </Field>
              <Field label="Etiqueta destinatario">
                <input
                  className={fieldClass}
                  value={draft.etiquetaDestinatario}
                  disabled={!canWrite}
                  onChange={(event) => patch('etiquetaDestinatario', event.target.value)}
                />
              </Field>
              <Field label="Formato de número">
                <select
                  className={fieldClass}
                  value={draft.usarNumeroCompleto ? 'completo' : 'padded'}
                  disabled={!canWrite}
                  onChange={(event) =>
                    patch('usarNumeroCompleto', event.target.value === 'completo')
                  }
                >
                  <option value="completo">Número completo</option>
                  <option value="padded">Solo número con ceros</option>
                </select>
              </Field>
              {!draft.usarNumeroCompleto && (
                <Field label="Dígitos (padding)">
                  <input
                    type="number"
                    min={0}
                    max={20}
                    className={fieldClass}
                    value={draft.paddingNumero}
                    disabled={!canWrite}
                    onChange={(event) => patch('paddingNumero', Number(event.target.value) || 0)}
                  />
                </Field>
              )}
            </div>
          </Section>

          <Section title="Logo">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.mostrarLogo}
                disabled={!canWrite}
                onChange={(event) => patch('mostrarLogo', event.target.checked)}
                className={checkboxClass}
              />
              Mostrar logo
            </label>
            {canWrite && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <Upload size={14} /> Subir logo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      handleImageUpload(event.target.files?.[0] ?? null, 'logoDataUrl', 'logo');
                      event.target.value = '';
                    }}
                  />
                </label>
                {draft.logoDataUrl && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => patch('logoDataUrl', null)}
                  >
                    <Trash2 size={14} /> Quitar logo
                  </Button>
                )}
              </div>
            )}
            <p className="text-xs text-slate-500">PNG, JPG o WEBP. Tamaño máximo: 1,5 MB.</p>
          </Section>

          <Section title="Contenido">
            <Field label="Texto de introducción">
              <textarea
                rows={5}
                className={fieldClass}
                value={draft.textoIntroduccion}
                disabled={!canWrite}
                onChange={(event) => patch('textoIntroduccion', event.target.value)}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Columna código">
                <input
                  className={fieldClass}
                  value={draft.columnaCodigo}
                  disabled={!canWrite}
                  onChange={(event) => patch('columnaCodigo', event.target.value)}
                />
              </Field>
              <Field label="Columna denominación">
                <input
                  className={fieldClass}
                  value={draft.columnaDenominacion}
                  disabled={!canWrite}
                  onChange={(event) => patch('columnaDenominacion', event.target.value)}
                />
              </Field>
              <Field label="Columna importe">
                <input
                  className={fieldClass}
                  value={draft.columnaImporte}
                  disabled={!canWrite}
                  onChange={(event) => patch('columnaImporte', event.target.value)}
                />
              </Field>
              <Field label="Etiqueta total">
                <input
                  className={fieldClass}
                  value={draft.etiquetaTotal}
                  disabled={!canWrite}
                  onChange={(event) => patch('etiquetaTotal', event.target.value)}
                />
              </Field>
              <Field label="Pie / departamento">
                <input
                  className={fieldClass}
                  value={draft.pieDepartamento}
                  disabled={!canWrite}
                  onChange={(event) => patch('pieDepartamento', event.target.value)}
                />
              </Field>
              <Field label="Formato de fecha">
                <select
                  className={fieldClass}
                  value={draft.formatoFecha}
                  disabled={!canWrite}
                  onChange={(event) =>
                    patch(
                      'formatoFecha',
                      event.target.value as ImpresionAfectacionConfig['formatoFecha']
                    )
                  }
                >
                  <option value="dd/mm/yy">DD/MM/AA</option>
                  <option value="dd/mm/yyyy">DD/MM/AAAA</option>
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.mostrarFechaPie}
                disabled={!canWrite}
                onChange={(event) => patch('mostrarFechaPie', event.target.checked)}
                className={checkboxClass}
              />
              Mostrar fecha en el pie
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.mostrarImporteLetrasDetalle}
                disabled={!canWrite}
                onChange={(event) =>
                  patch('mostrarImporteLetrasDetalle', event.target.checked)
                }
                className={checkboxClass}
              />
              Mostrar importes del detalle en letras
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.mostrarImporteLetrasTotal}
                disabled={!canWrite}
                onChange={(event) => patch('mostrarImporteLetrasTotal', event.target.checked)}
                className={checkboxClass}
              />
              Mostrar total en letras
            </label>
          </Section>

          <Section title="Firma / sello">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.mostrarFirmaSello}
                disabled={!canWrite}
                onChange={(event) => patch('mostrarFirmaSello', event.target.checked)}
                className={checkboxClass}
              />
              Mostrar firma / sello (opcional)
            </label>
            {canWrite && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <Upload size={14} /> Subir firma / sello
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      handleImageUpload(
                        event.target.files?.[0] ?? null,
                        'firmaSelloDataUrl',
                        'firma / sello'
                      );
                      event.target.value = '';
                    }}
                  />
                </label>
                {draft.firmaSelloDataUrl && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => patch('firmaSelloDataUrl', null)}
                  >
                    <Trash2 size={14} /> Quitar firma / sello
                  </Button>
                )}
              </div>
            )}
            <p className="text-xs text-slate-500">
              Aparece abajo a la derecha; podés moverla en la hoja.
            </p>
          </Section>

          <Section title="Posición campo por campo (mm)">
            {EDITABLE_IDS.map((id) => (
              <PosEditor
                key={id}
                fieldKey={id}
                label={AFECTACION_EDITABLE_LABELS[id]}
                pos={draft.campos[id]}
                disabled={!canWrite}
                selected={selectedId === id}
                onChange={(next) => patchCampo(id, next)}
              />
            ))}
          </Section>

          {!canWrite && (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Solo lectura. Se requiere permiso de configuración para editar este diseño.
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Eye size={16} className="text-primary-700" />
              Vista previa A4
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canWrite && (
                <Button
                  type="button"
                  variant={editOnSheet ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    setEditOnSheet((value) => {
                      if (value) setSelectedId(null);
                      return !value;
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
                  onChange={(event) => setPreviewScale(Number(event.target.value))}
                />
              </label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={pdfBusy}
                onClick={() => void handlePdfPreview()}
              >
                <Download size={14} /> Probar PDF
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handlePrintPreview}
              >
                <Printer size={14} /> Probar impresión
              </Button>
            </div>
          </div>

          {editOnSheet && (
            <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
              <strong className="font-semibold">Modo de edición.</strong> Hacé clic en un campo
              y arrastralo. Flechas: 0,5 mm · Shift+flecha: 0,1 · Alt+flecha: 1 mm. Shift al
              arrastrar bloquea el eje; Ctrl ajusta a la rejilla.
              {selectedId && (
                <span className="mt-1 block font-medium">
                  Seleccionado: {AFECTACION_EDITABLE_LABELS[selectedId]}
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
                <AfectacionPrintSheet
                  afectacion={sample}
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
            La vista previa usa datos de ejemplo. Guardá la configuración para aplicarla a las
            afectaciones reales.
          </p>
        </div>
      </div>

      <Modal
        open={resetModal}
        onClose={() => setResetModal(false)}
        title="Restablecer configuración"
        size="sm"
      >
        <p className="mb-5 text-sm text-slate-600">
          Se restaurarán las posiciones y opciones predeterminadas. Deberá guardar para aplicar
          los cambios en el sistema.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setResetModal(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              setDraft(structuredClone(DEFAULT_IMPRESION_AFECTACION));
              setSelectedId(null);
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
