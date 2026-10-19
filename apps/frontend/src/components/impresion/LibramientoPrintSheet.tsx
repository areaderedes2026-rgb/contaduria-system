import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { Libramiento } from '@/types';
import type {
  ImpresionLibramientoCampos,
  ImpresionLibramientoConfig,
  PrintColPos,
  PrintFieldPos,
} from '@/services/configuracion.service';
import { importeEnLetras } from '@/utils/importeEnLetras';

export interface LibramientoPrintDetalle {
  cuenta_codigo: string;
  cuenta_descripcion: string;
  descripcion: string;
  importe: number;
}

export interface LibramientoPrintRetencion {
  concepto: string;
  importe: number;
}

export interface LibramientoPrintData {
  numero: number;
  numero_completo: string;
  fecha: string;
  beneficiario: string;
  importe: number;
  retenciones: number;
  neto: number;
  numero_decreto: string | null;
  numero_cheque: string | null;
  expediente_numero?: string;
  afectacion_numero?: string;
  observaciones: string | null;
  detalle: LibramientoPrintDetalle[];
  retencionesDetalle: LibramientoPrintRetencion[];
}

/** Campos con posición absoluta X/Y propia */
export type LibramientoFieldKey = {
  [K in keyof ImpresionLibramientoCampos]: ImpresionLibramientoCampos[K] extends PrintFieldPos
    ? K
    : never;
}[keyof ImpresionLibramientoCampos];

/** Columnas de tabla (X propio; Y = inicio del bloque) */
export type LibramientoColKey =
  | 'detalleCodigo'
  | 'detalleDenominacion'
  | 'detalleImporte'
  | 'retencionConcepto'
  | 'retencionImporte';

export type LibramientoEditableId = LibramientoFieldKey | LibramientoColKey;

export const LIBRAMIENTO_EDITABLE_LABELS: Record<LibramientoEditableId, string> = {
  numero: 'Número (Nº)',
  son: 'Son (importe)',
  fechaDia: 'Fecha — día',
  fechaMes: 'Fecha — mes',
  fechaAnio: 'Fecha — año',
  beneficiario: 'Beneficiario',
  importeLetras: 'Importe en letras',
  concepto: 'Concepto',
  nCheque: 'Nº de Cheque',
  nDecreto: 'Nº Dec. / Resol.',
  nExpediente: 'Nº de Expediente',
  total: 'Total $',
  retencionesTotal: 'Retenciones $',
  liquido: 'Líquido $',
  reciboImporteLetras: 'Recibo — letras',
  reciboConcepto: 'Recibo — concepto',
  reciboDia: 'Recibo — día',
  reciboMes: 'Recibo — mes',
  reciboAnio: 'Recibo — año',
  detalleCodigo: 'Detalle — código',
  detalleDenominacion: 'Detalle — denominación',
  detalleImporte: 'Detalle — importe',
  retencionConcepto: 'Retención — concepto',
  retencionImporte: 'Retención — importe',
};

const COL_KEYS = new Set<string>([
  'detalleCodigo',
  'detalleDenominacion',
  'detalleImporte',
  'retencionConcepto',
  'retencionImporte',
]);

export function isLibramientoColKey(id: string): id is LibramientoColKey {
  return COL_KEYS.has(id);
}

export function isDetalleColKey(
  id: string
): id is 'detalleCodigo' | 'detalleDenominacion' | 'detalleImporte' {
  return id === 'detalleCodigo' || id === 'detalleDenominacion' || id === 'detalleImporte';
}

interface LibramientoPrintSheetProps {
  libramiento: LibramientoPrintData;
  config: ImpresionLibramientoConfig;
  preview?: boolean;
  forceGuia?: boolean;
  /** Solo en Impresiones: permite arrastrar / seleccionar en la hoja */
  interactive?: boolean;
  selectedId?: LibramientoEditableId | null;
  onSelectId?: (id: LibramientoEditableId | null) => void;
  /** Nueva posición en mm de config (sin offset global) */
  onMoveId?: (id: LibramientoEditableId, xMm: number, yMm: number) => void;
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseFechaParts(fecha: string): {
  dia: string;
  mes: string;
  anio: string;
  anio2: string;
  mesNombre: string;
} {
  const raw = fecha.slice(0, 10);
  const [y, m, d] = raw.split('-').map(Number);
  const safeY = Number.isFinite(y) ? y : 2000;
  const safeM = Number.isFinite(m) ? m : 1;
  const safeD = Number.isFinite(d) ? d : 1;
  return {
    dia: pad2(safeD),
    mes: pad2(safeM),
    anio: String(safeY),
    anio2: String(safeY).slice(-2),
    mesNombre: MESES[safeM - 1] ?? '',
  };
}

function formatImporteValor(value: number, config: ImpresionLibramientoConfig): string {
  const decimals = config.decimalesImporte;
  const fixed = value.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const num =
    decimals > 0 && decPart !== undefined ? `${withDots},${decPart}` : withDots;

  if (config.formatoImporte === 'con_simbolo') return `$ ${num}`;
  if (config.formatoImporte === 'solo_numero') {
    return decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
  }
  return num;
}

function formatLetras(value: number, config: ImpresionLibramientoConfig): string {
  if (!config.mostrarImporteLetras) return '';
  const text = importeEnLetras(value);
  return config.importeLetrasMayusculas ? text.toUpperCase() : text;
}

function resolveConcepto(
  data: LibramientoPrintData,
  config: ImpresionLibramientoConfig
): string {
  if (config.conceptoFuente === 'fijo') return config.conceptoFijo || '';
  if (config.conceptoFuente === 'vacio') return '';
  return (data.observaciones || '').trim();
}

function formatNumeroDoc(
  data: LibramientoPrintData,
  config: ImpresionLibramientoConfig
): string {
  if (config.usarNumeroCompleto) return data.numero_completo;
  const pad = Math.max(0, config.paddingNumero);
  return pad > 0 ? String(data.numero).padStart(pad, '0') : String(data.numero);
}

function roundMm(value: number, step = 0.1): number {
  const s = step > 0 ? step : 0.1;
  return Math.round(value / s) * s;
}

function clampMm(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fieldStyle(
  pos: PrintFieldPos,
  config: ImpresionLibramientoConfig,
  extra?: CSSProperties
): CSSProperties {
  const ox = config.offsetXMm;
  const oy = config.offsetYMm;
  const scale = config.escala || 1;
  return {
    position: 'absolute',
    left: `${(pos.xMm + ox) * scale}mm`,
    top: `${(pos.yMm + oy) * scale}mm`,
    width: pos.widthMm != null ? `${pos.widthMm * scale}mm` : undefined,
    height: pos.heightMm != null ? `${pos.heightMm * scale}mm` : undefined,
    fontSize: `${(pos.fontSizePt ?? config.tamanoFuenteBasePt) * scale}pt`,
    textAlign: pos.align ?? 'left',
    letterSpacing:
      pos.letterSpacingEm != null ? `${pos.letterSpacingEm}em` : undefined,
    color: config.colorTexto,
    fontFamily: config.fuente,
    lineHeight: 1.15,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflow: 'hidden',
    ...extra,
  };
}

function colStyle(
  col: PrintColPos,
  yMm: number,
  config: ImpresionLibramientoConfig
): CSSProperties {
  return fieldStyle(
    {
      xMm: col.xMm,
      yMm,
      widthMm: col.widthMm,
      fontSizePt: col.fontSizePt,
      align: col.align,
      letterSpacingEm: col.letterSpacingEm,
      visible: col.visible,
    },
    config
  );
}

type DragState = {
  id: LibramientoEditableId;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originXMm: number;
  originYMm: number;
  axisLock: 'x' | 'y' | null;
};

function OverlayField({
  editId,
  label,
  pos,
  config,
  preview,
  interactive,
  selected,
  onPointerDownField,
  children,
}: {
  editId: LibramientoFieldKey;
  label: string;
  pos: PrintFieldPos;
  config: ImpresionLibramientoConfig;
  preview?: boolean;
  interactive?: boolean;
  selected?: boolean;
  onPointerDownField?: (id: LibramientoEditableId, e: ReactPointerEvent<HTMLDivElement>) => void;
  children: ReactNode;
}) {
  if (pos.visible === false && !interactive) return null;
  if (pos.visible === false && interactive) {
    // En edición mostramos fantasma para poder reubicar campos ocultos
  }

  const showTag = Boolean(
    (preview && config.mostrarNombresCamposPreview) || (interactive && selected)
  );

  const className = [
    interactive ? 'libramiento-print-editable' : '',
    interactive && selected ? 'libramiento-print-editable--selected' : '',
    pos.visible === false ? 'libramiento-print-editable--ghost' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      style={fieldStyle(pos, config, interactive ? { zIndex: selected ? 6 : 3 } : undefined)}
      data-print-field={label}
      data-edit-id={editId}
      className={className || undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `Mover ${label}` : undefined}
      onPointerDown={
        interactive && onPointerDownField
          ? (e) => onPointerDownField(editId, e)
          : undefined
      }
    >
      {showTag && (
        <span className="libramiento-print-field-tag no-print">{label}</span>
      )}
      {children}
    </div>
  );
}

function OverlayColCell({
  editId,
  label,
  col,
  yMm,
  config,
  interactive,
  selected,
  onPointerDownField,
  children,
}: {
  editId: LibramientoColKey;
  label: string;
  col: PrintColPos;
  yMm: number;
  config: ImpresionLibramientoConfig;
  interactive?: boolean;
  selected?: boolean;
  onPointerDownField?: (id: LibramientoEditableId, e: ReactPointerEvent<HTMLDivElement>) => void;
  children: ReactNode;
}) {
  if (col.visible === false && !interactive) return null;

  const className = [
    interactive ? 'libramiento-print-editable' : '',
    interactive && selected ? 'libramiento-print-editable--selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      style={colStyle(col, yMm, config)}
      data-print-field={label}
      data-edit-id={editId}
      className={className || undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `Mover ${label}` : undefined}
      onPointerDown={
        interactive && onPointerDownField
          ? (e) => onPointerDownField(editId, e)
          : undefined
      }
    >
      {interactive && selected && (
        <span className="libramiento-print-field-tag no-print">{label}</span>
      )}
      {children}
    </div>
  );
}

export function libramientoToPrintData(libramiento: Libramiento): LibramientoPrintData {
  return {
    numero: libramiento.numero,
    numero_completo: libramiento.numero_completo,
    fecha: libramiento.fecha,
    beneficiario: libramiento.beneficiario || '',
    importe: Number(libramiento.importe) || 0,
    retenciones: Number(libramiento.retenciones) || 0,
    neto: Number(libramiento.neto) || 0,
    numero_decreto: libramiento.numero_decreto,
    numero_cheque: null,
    expediente_numero: libramiento.expediente_numero,
    afectacion_numero: libramiento.afectacion_numero,
    observaciones: libramiento.observaciones,
    detalle: (libramiento.detalle ?? []).map((line) => ({
      cuenta_codigo: line.cuenta_codigo || '',
      cuenta_descripcion: line.cuenta_descripcion || '',
      descripcion: line.descripcion || '',
      importe: Number(line.importe) || 0,
    })),
    retencionesDetalle:
      Number(libramiento.retenciones) > 0
        ? [{ concepto: 'Retenciones', importe: Number(libramiento.retenciones) }]
        : [],
  };
}

export function sampleLibramientoPrintData(): LibramientoPrintData {
  return {
    numero: 12,
    numero_completo: '12/2026',
    fecha: '2026-08-04',
    beneficiario: 'PROVEEDOR DE EJEMPLO S.A.',
    importe: 125430.5,
    retenciones: 3540.2,
    neto: 121890.3,
    numero_decreto: 'Dec. 145/26',
    numero_cheque: '000458',
    expediente_numero: '2026-0123',
    afectacion_numero: '8-040826',
    observaciones: 'Adquisición de insumos de oficina',
    detalle: [
      {
        cuenta_codigo: '1.1.1',
        cuenta_descripcion: 'Gastos de funcionamiento',
        descripcion: 'Útiles de oficina',
        importe: 80430.5,
      },
      {
        cuenta_codigo: '2.3.1',
        cuenta_descripcion: 'Servicios no personales',
        descripcion: 'Mantenimiento',
        importe: 45000,
      },
    ],
    retencionesDetalle: [
      { concepto: 'IIBB', importe: 2100 },
      { concepto: 'Ganancias', importe: 1440.2 },
    ],
  };
}

function readOrigin(
  id: LibramientoEditableId,
  config: ImpresionLibramientoConfig
): { xMm: number; yMm: number } {
  const c = config.campos;
  if (isLibramientoColKey(id)) {
    const col = c[id];
    const yMm = isDetalleColKey(id) ? c.detalleInicioYMm : c.retencionesInicioYMm;
    return { xMm: col.xMm, yMm };
  }
  const pos = c[id];
  return { xMm: pos.xMm, yMm: pos.yMm };
}

export function LibramientoPrintSheet({
  libramiento,
  config,
  preview = false,
  forceGuia = false,
  interactive = false,
  selectedId = null,
  onSelectId,
  onMoveId,
}: LibramientoPrintSheetProps) {
  const c = config.campos;
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [draggingId, setDraggingId] = useState<LibramientoEditableId | null>(null);

  const fecha = parseFechaParts(libramiento.fecha);
  const anioBox = config.anioFechaDosDigitos ? fecha.anio2 : fecha.anio;
  const numero = formatNumeroDoc(libramiento, config);
  const concepto = resolveConcepto(libramiento, config);
  const letras = formatLetras(libramiento.importe, config);
  const letrasNeto = formatLetras(libramiento.neto, config);

  const showGuia =
    (preview && config.mostrarGuiaEnPreview) ||
    forceGuia ||
    (config.incluirGuiaEnPdf && !preview);

  const detalle = libramiento.detalle.slice(0, c.detalleMaxFilas);
  const retenciones = config.imprimirRetencionesLineas
    ? libramiento.retencionesDetalle.slice(0, c.retencionesMaxFilas)
    : [];

  const applyMove = useCallback(
    (
      id: LibramientoEditableId,
      originXMm: number,
      originYMm: number,
      deltaDisplayMmX: number,
      deltaDisplayMmY: number,
      opts: { shiftKey: boolean; ctrlKey: boolean; axisLock: 'x' | 'y' | null }
    ): 'x' | 'y' | null => {
      if (!onMoveId) return opts.axisLock;
      const scale = config.escala || 1;
      let dx = deltaDisplayMmX / scale;
      let dy = deltaDisplayMmY / scale;

      let axisLock = opts.axisLock;
      if (opts.shiftKey) {
        if (!axisLock) {
          axisLock = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
        }
        if (axisLock === 'x') dy = 0;
        if (axisLock === 'y') dx = 0;
      }

      let nextX = originXMm + dx;
      let nextY = originYMm + dy;

      const snapStep =
        opts.ctrlKey || config.mostrarRejilla
          ? Math.max(0.5, config.rejillaPasoMm || 5)
          : 0.1;
      nextX = roundMm(nextX, snapStep > 0.1 && (opts.ctrlKey || config.mostrarRejilla) ? snapStep : 0.1);
      nextY = roundMm(nextY, snapStep > 0.1 && (opts.ctrlKey || config.mostrarRejilla) ? snapStep : 0.1);

      nextX = clampMm(nextX, -20, 210);
      nextY = clampMm(nextY, -20, 297);

      onMoveId(id, nextX, nextY);
      return axisLock;
    },
    [onMoveId, config.escala, config.mostrarRejilla, config.rejillaPasoMm]
  );

  const handlePointerDownField = useCallback(
    (id: LibramientoEditableId, e: ReactPointerEvent<HTMLDivElement>) => {
      if (!interactive || !onMoveId) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      onSelectId?.(id);
      const origin = readOrigin(id, config);
      dragRef.current = {
        id,
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        originXMm: origin.xMm,
        originYMm: origin.yMm,
        axisLock: null,
      };
      setDraggingId(id);
    },
    [interactive, onMoveId, onSelectId, config]
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const sheet = sheetRef.current;
      if (!sheet) return;

      const rect = sheet.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const deltaDisplayMmX = ((e.clientX - drag.startClientX) / rect.width) * 210;
      const deltaDisplayMmY = ((e.clientY - drag.startClientY) / rect.height) * 297;

      const axisLock = applyMove(
        drag.id,
        drag.originXMm,
        drag.originYMm,
        deltaDisplayMmX,
        deltaDisplayMmY,
        { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey || e.metaKey, axisLock: drag.axisLock }
      );
      drag.axisLock = axisLock;
    },
    [applyMove]
  );

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDraggingId(null);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  // Teclado: flechas mueven el campo seleccionado
  useEffect(() => {
    if (!interactive || !selectedId || !onMoveId) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        onSelectId?.(null);
        return;
      }

      const arrow =
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown';
      if (!arrow) return;

      e.preventDefault();
      const step = e.altKey ? 1 : e.shiftKey ? 0.1 : 0.5;
      const origin = readOrigin(selectedId, config);
      let nextX = origin.xMm;
      let nextY = origin.yMm;
      if (e.key === 'ArrowLeft') nextX -= step;
      if (e.key === 'ArrowRight') nextX += step;
      if (e.key === 'ArrowUp') nextY -= step;
      if (e.key === 'ArrowDown') nextY += step;
      nextX = clampMm(roundMm(nextX), -20, 210);
      nextY = clampMm(roundMm(nextY), -20, 297);
      onMoveId(selectedId, nextX, nextY);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [interactive, selectedId, onMoveId, onSelectId, config]);

  const sheetStyle: CSSProperties = {
    position: 'relative',
    width: '210mm',
    height: '297mm',
    boxSizing: 'border-box',
    overflow: 'hidden',
    background: preview || showGuia ? '#fff' : 'transparent',
    color: config.colorTexto,
    fontFamily: config.fuente,
    fontSize: `${config.tamanoFuenteBasePt}pt`,
    outline: interactive ? '2px solid #93c5fd' : undefined,
    cursor: interactive ? 'default' : undefined,
    touchAction: interactive ? 'none' : undefined,
  };

  const selectedLabel = selectedId ? LIBRAMIENTO_EDITABLE_LABELS[selectedId] : null;
  const selectedOrigin = selectedId ? readOrigin(selectedId, config) : null;

  return (
    <div
      ref={sheetRef}
      id={interactive ? 'libramiento-print-sheet-editor' : 'libramiento-print-sheet'}
      className={[
        'libramiento-print-sheet',
        preview ? 'libramiento-print-preview' : '',
        interactive ? 'libramiento-print-sheet--interactive' : '',
        draggingId ? 'libramiento-print-sheet--dragging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={sheetStyle}
      data-preview={preview ? 'true' : undefined}
      data-interactive={interactive ? 'true' : undefined}
      onPointerMove={interactive ? handlePointerMove : undefined}
      onPointerUp={interactive ? endDrag : undefined}
      onPointerCancel={interactive ? endDrag : undefined}
      onClick={
        interactive
          ? (e) => {
              if (e.target === e.currentTarget) onSelectId?.(null);
            }
          : undefined
      }
    >
      {showGuia && config.guiaDataUrl && (
        <img
          src={config.guiaDataUrl}
          alt=""
          className="libramiento-print-guia"
          aria-hidden
          draggable={false}
        />
      )}

      {preview && config.mostrarRejilla && (
        <div
          className="libramiento-print-rejilla no-print"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(37,99,235,0.18) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(37,99,235,0.18) 1px, transparent 1px)
            `,
            backgroundSize: `${config.rejillaPasoMm}mm ${config.rejillaPasoMm}mm`,
          }}
        />
      )}

      {interactive && selectedLabel && selectedOrigin && (
        <div className="libramiento-print-hud no-print" aria-live="polite">
          <strong>{selectedLabel}</strong>
          <span>
            x {selectedOrigin.xMm.toFixed(1)} mm · y {selectedOrigin.yMm.toFixed(1)} mm
          </span>
          <span className="libramiento-print-hud-hint">
            Arrastrar · Flechas 0,5 · Shift 0,1 · Alt 1 · Shift+arrastre eje · Ctrl snap
          </span>
        </div>
      )}

      <OverlayField
        editId="numero"
        label="Nº"
        pos={c.numero}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'numero'}
        onPointerDownField={handlePointerDownField}
      >
        {numero}
      </OverlayField>

      <OverlayField
        editId="son"
        label="Son"
        pos={c.son}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'son'}
        onPointerDownField={handlePointerDownField}
      >
        {formatImporteValor(libramiento.importe, config)}
      </OverlayField>

      <OverlayField
        editId="fechaDia"
        label="Día"
        pos={c.fechaDia}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'fechaDia'}
        onPointerDownField={handlePointerDownField}
      >
        {fecha.dia}
      </OverlayField>
      <OverlayField
        editId="fechaMes"
        label="Mes"
        pos={c.fechaMes}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'fechaMes'}
        onPointerDownField={handlePointerDownField}
      >
        {fecha.mes}
      </OverlayField>
      <OverlayField
        editId="fechaAnio"
        label="Año"
        pos={c.fechaAnio}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'fechaAnio'}
        onPointerDownField={handlePointerDownField}
      >
        {anioBox}
      </OverlayField>

      <OverlayField
        editId="beneficiario"
        label="Beneficiario"
        pos={c.beneficiario}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'beneficiario'}
        onPointerDownField={handlePointerDownField}
      >
        {libramiento.beneficiario}
      </OverlayField>

      <OverlayField
        editId="importeLetras"
        label="Importe letras"
        pos={c.importeLetras}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'importeLetras'}
        onPointerDownField={handlePointerDownField}
      >
        {letras}
      </OverlayField>

      <OverlayField
        editId="concepto"
        label="Concepto"
        pos={c.concepto}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'concepto'}
        onPointerDownField={handlePointerDownField}
      >
        {concepto}
      </OverlayField>

      {(config.imprimirNCheque || interactive) && (
        <OverlayField
          editId="nCheque"
          label="Cheque"
          pos={c.nCheque}
          config={config}
          preview={preview}
          interactive={interactive}
          selected={selectedId === 'nCheque'}
          onPointerDownField={handlePointerDownField}
        >
          {libramiento.numero_cheque || (interactive ? '—' : '')}
        </OverlayField>
      )}

      <OverlayField
        editId="nDecreto"
        label="Decreto"
        pos={c.nDecreto}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'nDecreto'}
        onPointerDownField={handlePointerDownField}
      >
        {libramiento.numero_decreto || ''}
      </OverlayField>

      <OverlayField
        editId="nExpediente"
        label="Expediente"
        pos={c.nExpediente}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'nExpediente'}
        onPointerDownField={handlePointerDownField}
      >
        {libramiento.expediente_numero || ''}
      </OverlayField>

      {detalle.map((line, idx) => {
        const y = c.detalleInicioYMm + idx * c.detalleAltoFilaMm;
        const denom =
          (line.descripcion || '').trim() || (line.cuenta_descripcion || '').trim();
        return (
          <div key={`det-${idx}`}>
            <OverlayColCell
              editId="detalleCodigo"
              label="Código"
              col={c.detalleCodigo}
              yMm={y}
              config={config}
              interactive={interactive}
              selected={selectedId === 'detalleCodigo'}
              onPointerDownField={handlePointerDownField}
            >
              {line.cuenta_codigo}
            </OverlayColCell>
            <OverlayColCell
              editId="detalleDenominacion"
              label="Denominación"
              col={c.detalleDenominacion}
              yMm={y}
              config={config}
              interactive={interactive}
              selected={selectedId === 'detalleDenominacion'}
              onPointerDownField={handlePointerDownField}
            >
              {denom}
            </OverlayColCell>
            <OverlayColCell
              editId="detalleImporte"
              label="Importe"
              col={c.detalleImporte}
              yMm={y}
              config={config}
              interactive={interactive}
              selected={selectedId === 'detalleImporte'}
              onPointerDownField={handlePointerDownField}
            >
              {formatImporteValor(line.importe, config)}
            </OverlayColCell>
          </div>
        );
      })}

      {retenciones.map((line, idx) => {
        const y = c.retencionesInicioYMm + idx * c.retencionesAltoFilaMm;
        return (
          <div key={`ret-${idx}`}>
            <OverlayColCell
              editId="retencionConcepto"
              label="Ret. concepto"
              col={c.retencionConcepto}
              yMm={y}
              config={config}
              interactive={interactive}
              selected={selectedId === 'retencionConcepto'}
              onPointerDownField={handlePointerDownField}
            >
              {line.concepto}
            </OverlayColCell>
            <OverlayColCell
              editId="retencionImporte"
              label="Ret. importe"
              col={c.retencionImporte}
              yMm={y}
              config={config}
              interactive={interactive}
              selected={selectedId === 'retencionImporte'}
              onPointerDownField={handlePointerDownField}
            >
              {formatImporteValor(line.importe, config)}
            </OverlayColCell>
          </div>
        );
      })}

      <OverlayField
        editId="total"
        label="Total"
        pos={c.total}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'total'}
        onPointerDownField={handlePointerDownField}
      >
        {formatImporteValor(libramiento.importe, config)}
      </OverlayField>
      <OverlayField
        editId="retencionesTotal"
        label="Retenciones $"
        pos={c.retencionesTotal}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'retencionesTotal'}
        onPointerDownField={handlePointerDownField}
      >
        {formatImporteValor(libramiento.retenciones, config)}
      </OverlayField>
      <OverlayField
        editId="liquido"
        label="Líquido"
        pos={c.liquido}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'liquido'}
        onPointerDownField={handlePointerDownField}
      >
        {formatImporteValor(libramiento.neto, config)}
      </OverlayField>

      {(config.imprimirSeccionRecibo || interactive) && (
        <>
          <OverlayField
            editId="reciboImporteLetras"
            label="Recibo letras"
            pos={c.reciboImporteLetras}
            config={config}
            preview={preview}
            interactive={interactive}
            selected={selectedId === 'reciboImporteLetras'}
            onPointerDownField={handlePointerDownField}
          >
            {letrasNeto || letras}
          </OverlayField>
          <OverlayField
            editId="reciboConcepto"
            label="Recibo concepto"
            pos={c.reciboConcepto}
            config={config}
            preview={preview}
            interactive={interactive}
            selected={selectedId === 'reciboConcepto'}
            onPointerDownField={handlePointerDownField}
          >
            {concepto}
          </OverlayField>
          <OverlayField
            editId="reciboDia"
            label="Recibo día"
            pos={c.reciboDia}
            config={config}
            preview={preview}
            interactive={interactive}
            selected={selectedId === 'reciboDia'}
            onPointerDownField={handlePointerDownField}
          >
            {fecha.dia}
          </OverlayField>
          <OverlayField
            editId="reciboMes"
            label="Recibo mes"
            pos={c.reciboMes}
            config={config}
            preview={preview}
            interactive={interactive}
            selected={selectedId === 'reciboMes'}
            onPointerDownField={handlePointerDownField}
          >
            {config.mesReciboEnLetras ? fecha.mesNombre : fecha.mes}
          </OverlayField>
          <OverlayField
            editId="reciboAnio"
            label="Recibo año"
            pos={c.reciboAnio}
            config={config}
            preview={preview}
            interactive={interactive}
            selected={selectedId === 'reciboAnio'}
            onPointerDownField={handlePointerDownField}
          >
            {fecha.anio2}
          </OverlayField>
        </>
      )}
    </div>
  );
}
