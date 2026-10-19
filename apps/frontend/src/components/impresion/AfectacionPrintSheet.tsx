import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { ImpresionAfectacionConfig, PrintFieldPos } from '@/services/configuracion.service';
import type { Afectacion } from '@/types';
import { formatAfectacionNumero } from '@/utils/format';
import { importeEnLetras } from '@/utils/importeEnLetras';

export interface AfectacionPrintData {
  numero: number;
  numero_completo: string;
  fecha: string;
  expediente_numero?: string;
  destinatario: string;
  importe_total: number;
  detalle: Array<{
    cuenta_codigo?: string;
    cuenta_descripcion?: string;
    descripcion: string;
    importe: number;
  }>;
}

export type AfectacionEditableId = keyof ImpresionAfectacionConfig['campos'];

export const AFECTACION_EDITABLE_LABELS: Record<AfectacionEditableId, string> = {
  logo: 'Logo',
  organismo: 'Organismo',
  titulo: 'Título',
  numero: 'Número',
  expediente: 'Expediente',
  destinatario: 'Destinatario',
  intro: 'Introducción',
  detalle: 'Detalle',
  total: 'Total',
  pie: 'Pie',
  firmaSello: 'Firma / sello',
};

interface AfectacionPrintSheetProps {
  afectacion: AfectacionPrintData;
  config: ImpresionAfectacionConfig;
  preview?: boolean;
  interactive?: boolean;
  selectedId?: AfectacionEditableId | null;
  onSelectId?: (id: AfectacionEditableId | null) => void;
  onMoveId?: (id: AfectacionEditableId, xMm: number, yMm: number) => void;
}

const FONT_SCALE: Record<ImpresionAfectacionConfig['tamanoFuente'], number> = {
  pequeno: 0.88,
  normal: 1,
  grande: 1.14,
};

function formatImporteDocumento(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function ImporteConLetras({
  valor,
  mostrarLetras,
}: {
  valor: number;
  mostrarLetras: boolean;
}) {
  return (
    <span className="afectacion-print-importe inline-flex flex-wrap items-baseline justify-end gap-x-1.5">
      <span className="whitespace-nowrap tabular-nums">{formatImporteDocumento(valor)}</span>
      {mostrarLetras && (
        <span className="afectacion-print-importe-letras uppercase leading-tight">
          {importeEnLetras(valor)}
        </span>
      )}
    </span>
  );
}

function formatFechaPie(
  fecha: string,
  formato: ImpresionAfectacionConfig['formatoFecha']
): string {
  const [y, m, d] = fecha.split('-');
  if (!y || !m || !d) return fecha;
  if (formato === 'dd/mm/yyyy') return `${d}/${m}/${y}`;
  return `${d}/${m}/${y.slice(-2)}`;
}

function formatNumeroImpresion(
  afectacion: AfectacionPrintData,
  config: ImpresionAfectacionConfig
): string {
  if (config.usarNumeroCompleto) {
    return (
      afectacion.numero_completo ||
      formatAfectacionNumero(afectacion.numero, afectacion.fecha)
    );
  }
  return String(afectacion.numero).padStart(Math.max(0, config.paddingNumero), '0');
}

function formatCodigoCuenta(codigo: string): string {
  return codigo.replace(/\./g, ' ').trim();
}

function roundMm(value: number, step = 0.1): number {
  const safeStep = step > 0 ? step : 0.1;
  return Math.round(value / safeStep) * safeStep;
}

function clampMm(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fieldStyle(
  pos: PrintFieldPos,
  config: ImpresionAfectacionConfig,
  extra?: CSSProperties
): CSSProperties {
  const scale = config.escala || 1;
  const fontScale = FONT_SCALE[config.tamanoFuente ?? 'normal'] ?? 1;
  return {
    position: 'absolute',
    left: `${(pos.xMm + config.offsetXMm) * scale}mm`,
    top: `${(pos.yMm + config.offsetYMm) * scale}mm`,
    width: pos.widthMm != null ? `${pos.widthMm * scale}mm` : undefined,
    height: pos.heightMm != null ? `${pos.heightMm * scale}mm` : undefined,
    fontSize: `${(pos.fontSizePt ?? 11) * fontScale * scale}pt`,
    textAlign: pos.align ?? 'left',
    letterSpacing:
      pos.letterSpacingEm != null ? `${pos.letterSpacingEm}em` : undefined,
    color: '#000',
    fontFamily: "'Courier New', Courier, monospace",
    lineHeight: 1.35,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflow: 'hidden',
    ...extra,
  };
}

type DragState = {
  id: AfectacionEditableId;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originXMm: number;
  originYMm: number;
  axisLock: 'x' | 'y' | null;
};

function OverlayField({
  editId,
  pos,
  config,
  preview,
  interactive,
  selected,
  ghost,
  onPointerDownField,
  children,
}: {
  editId: AfectacionEditableId;
  pos: PrintFieldPos;
  config: ImpresionAfectacionConfig;
  preview?: boolean;
  interactive?: boolean;
  selected?: boolean;
  ghost?: boolean;
  onPointerDownField?: (
    id: AfectacionEditableId,
    event: ReactPointerEvent<HTMLDivElement>
  ) => void;
  children: ReactNode;
}) {
  if (pos.visible === false && !interactive) return null;

  const label = AFECTACION_EDITABLE_LABELS[editId];
  const showTag = Boolean(
    (preview && config.mostrarNombresCamposPreview) || (interactive && selected)
  );
  const className = [
    interactive ? 'libramiento-print-editable' : '',
    interactive && selected ? 'libramiento-print-editable--selected' : '',
    pos.visible === false || ghost ? 'libramiento-print-editable--ghost' : '',
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
          ? (event) => onPointerDownField(editId, event)
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

function readOrigin(
  id: AfectacionEditableId,
  config: ImpresionAfectacionConfig
): { xMm: number; yMm: number } {
  const pos = config.campos[id];
  return { xMm: pos.xMm, yMm: pos.yMm };
}

export function afectacionToPrintData(afectacion: Afectacion): AfectacionPrintData {
  return {
    numero: afectacion.numero,
    numero_completo: afectacion.numero_completo,
    fecha: afectacion.fecha,
    expediente_numero: afectacion.expediente_numero,
    destinatario: afectacion.destinatario,
    importe_total: afectacion.importe_total,
    detalle: (afectacion.detalle ?? []).map((detalle) => ({
      cuenta_codigo: detalle.cuenta_codigo,
      cuenta_descripcion: detalle.cuenta_descripcion,
      descripcion: detalle.descripcion,
      importe: detalle.importe,
    })),
  };
}

export function sampleAfectacionPrintData(): AfectacionPrintData {
  return {
    numero: 1,
    numero_completo: '1/2026',
    fecha: new Date().toISOString().slice(0, 10),
    expediente_numero: 'Nº de expediente',
    destinatario: 'Nombre del destinatario',
    importe_total: 1250.75,
    detalle: [
      {
        cuenta_codigo: '1.1.01.00.00.00',
        cuenta_descripcion: 'Denominación de la cuenta',
        descripcion: 'Concepto / descripción de la partida',
        importe: 750.5,
      },
      {
        cuenta_codigo: '1.1.02.00.00.00',
        cuenta_descripcion: 'Otra denominación',
        descripcion: 'Segunda partida de ejemplo',
        importe: 500.25,
      },
    ],
  };
}

export function AfectacionPrintSheet({
  afectacion,
  config,
  preview = false,
  interactive = false,
  selectedId = null,
  onSelectId,
  onMoveId,
}: AfectacionPrintSheetProps) {
  const campos = config.campos;
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [draggingId, setDraggingId] = useState<AfectacionEditableId | null>(null);

  const numeroMostrar = formatNumeroImpresion(afectacion, config);
  const total =
    afectacion.detalle.reduce((sum, line) => sum + Number(line.importe || 0), 0) ||
    Number(afectacion.importe_total || 0);

  const applyMove = useCallback(
    (
      id: AfectacionEditableId,
      originXMm: number,
      originYMm: number,
      deltaDisplayMmX: number,
      deltaDisplayMmY: number,
      options: {
        shiftKey: boolean;
        ctrlKey: boolean;
        axisLock: 'x' | 'y' | null;
      }
    ): 'x' | 'y' | null => {
      if (!onMoveId) return options.axisLock;

      const scale = config.escala || 1;
      let dx = deltaDisplayMmX / scale;
      let dy = deltaDisplayMmY / scale;
      let axisLock = options.axisLock;

      if (options.shiftKey) {
        if (!axisLock) axisLock = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
        if (axisLock === 'x') dy = 0;
        if (axisLock === 'y') dx = 0;
      }

      const snapStep = options.ctrlKey
        ? 0.5
        : config.mostrarRejilla
          ? Math.max(0.5, config.rejillaPasoMm || 5)
          : 0.1;
      const nextX = clampMm(roundMm(originXMm + dx, snapStep), -20, 210);
      const nextY = clampMm(roundMm(originYMm + dy, snapStep), -20, 297);
      onMoveId(id, nextX, nextY);
      return axisLock;
    },
    [config.escala, config.mostrarRejilla, config.rejillaPasoMm, onMoveId]
  );

  const handlePointerDownField = useCallback(
    (id: AfectacionEditableId, event: ReactPointerEvent<HTMLDivElement>) => {
      if (!interactive || !onMoveId) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      onSelectId?.(id);
      const origin = readOrigin(id, config);
      dragRef.current = {
        id,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        originXMm: origin.xMm,
        originYMm: origin.yMm,
        axisLock: null,
      };
      setDraggingId(id);
    },
    [config, interactive, onMoveId, onSelectId]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      const sheet = sheetRef.current;
      if (!drag || drag.pointerId !== event.pointerId || !sheet) return;

      const rect = sheet.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      drag.axisLock = applyMove(
        drag.id,
        drag.originXMm,
        drag.originYMm,
        ((event.clientX - drag.startClientX) / rect.width) * 210,
        ((event.clientY - drag.startClientY) / rect.height) * 297,
        {
          shiftKey: event.shiftKey,
          ctrlKey: event.ctrlKey || event.metaKey,
          axisLock: drag.axisLock,
        }
      );
    },
    [applyMove]
  );

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDraggingId(null);
  }, []);

  useEffect(() => {
    if (!interactive || !selectedId || !onMoveId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === 'Escape') {
        onSelectId?.(null);
        return;
      }

      if (
        event.key !== 'ArrowLeft' &&
        event.key !== 'ArrowRight' &&
        event.key !== 'ArrowUp' &&
        event.key !== 'ArrowDown'
      ) {
        return;
      }

      event.preventDefault();
      const step = event.altKey ? 1 : event.shiftKey ? 0.1 : 0.5;
      const origin = readOrigin(selectedId, config);
      let nextX = origin.xMm;
      let nextY = origin.yMm;
      if (event.key === 'ArrowLeft') nextX -= step;
      if (event.key === 'ArrowRight') nextX += step;
      if (event.key === 'ArrowUp') nextY -= step;
      if (event.key === 'ArrowDown') nextY += step;
      onMoveId(
        selectedId,
        clampMm(roundMm(nextX), -20, 210),
        clampMm(roundMm(nextY), -20, 297)
      );
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config, interactive, onMoveId, onSelectId, selectedId]);

  const sheetStyle: CSSProperties = {
    position: 'relative',
    width: '210mm',
    minHeight: '297mm',
    height: '297mm',
    padding: 0,
    overflow: 'hidden',
    boxSizing: 'border-box',
    background: '#fff',
    color: '#000',
    fontFamily: "'Courier New', Courier, monospace",
    outline: interactive ? '2px solid #93c5fd' : undefined,
    cursor: interactive ? 'default' : undefined,
    touchAction: interactive ? 'none' : undefined,
  };

  const selectedLabel = selectedId ? AFECTACION_EDITABLE_LABELS[selectedId] : null;
  const selectedOrigin = selectedId ? readOrigin(selectedId, config) : null;
  const showFirmaSello =
    interactive || Boolean(config.mostrarFirmaSello && config.firmaSelloDataUrl);

  return (
    <div
      ref={sheetRef}
      id="afectacion-print-sheet"
      className={[
        'afectacion-print-sheet',
        'afectacion-print-a4',
        'libramiento-print-sheet',
        preview ? 'mx-auto shadow-md ring-1 ring-slate-200' : '',
        interactive
          ? 'afectacion-print-sheet--interactive libramiento-print-sheet--interactive'
          : '',
        draggingId
          ? 'afectacion-print-sheet--dragging libramiento-print-sheet--dragging'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={sheetStyle}
      data-font-size={config.tamanoFuente}
      data-preview={preview ? 'true' : undefined}
      data-interactive={interactive ? 'true' : undefined}
      onPointerMove={interactive ? handlePointerMove : undefined}
      onPointerUp={interactive ? endDrag : undefined}
      onPointerCancel={interactive ? endDrag : undefined}
      onClick={
        interactive
          ? (event) => {
              if (event.target === event.currentTarget) onSelectId?.(null);
            }
          : undefined
      }
    >
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
            0,5
          </span>
        </div>
      )}

      {(config.mostrarLogo || interactive) && (
        <OverlayField
          editId="logo"
          pos={campos.logo}
          config={config}
          preview={preview}
          interactive={interactive}
          selected={selectedId === 'logo'}
          ghost={!config.mostrarLogo}
          onPointerDownField={handlePointerDownField}
        >
          {config.logoDataUrl ? (
            <img
              src={config.logoDataUrl}
              alt=""
              className="h-full w-full object-contain"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-black/40 text-[10px] font-semibold uppercase tracking-wide text-black/50">
              Logo
            </div>
          )}
        </OverlayField>
      )}

      <OverlayField
        editId="organismo"
        pos={campos.organismo}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'organismo'}
        onPointerDownField={handlePointerDownField}
      >
        <p className="afectacion-print-organismo">{config.organismo}</p>
      </OverlayField>

      <OverlayField
        editId="titulo"
        pos={campos.titulo}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'titulo'}
        onPointerDownField={handlePointerDownField}
      >
        <h1 className="afectacion-print-titulo underline decoration-1 underline-offset-4">
          {config.tituloDocumento}
        </h1>
      </OverlayField>

      <OverlayField
        editId="numero"
        pos={campos.numero}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'numero'}
        onPointerDownField={handlePointerDownField}
      >
        <p className="afectacion-print-numero">
          {config.etiquetaNumero} {numeroMostrar}
        </p>
      </OverlayField>

      <OverlayField
        editId="expediente"
        pos={campos.expediente}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'expediente'}
        onPointerDownField={handlePointerDownField}
      >
        <p>
          {config.etiquetaExpediente}: {afectacion.expediente_numero || '—'}
        </p>
      </OverlayField>

      <OverlayField
        editId="destinatario"
        pos={campos.destinatario}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'destinatario'}
        onPointerDownField={handlePointerDownField}
      >
        <p>
          {config.etiquetaDestinatario}: {afectacion.destinatario || '—'}
        </p>
      </OverlayField>

      <OverlayField
        editId="intro"
        pos={campos.intro}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'intro'}
        onPointerDownField={handlePointerDownField}
      >
        {config.textoIntroduccion}
      </OverlayField>

      <OverlayField
        editId="detalle"
        pos={campos.detalle}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'detalle'}
        onPointerDownField={handlePointerDownField}
      >
        <table className="afectacion-print-table w-full border-collapse">
          <thead>
            <tr className="border-b border-black">
              <th className="py-1.5 pr-3 text-left font-normal">{config.columnaCodigo}</th>
              <th className="px-2 py-1.5 text-left font-normal">
                {config.columnaDenominacion}
              </th>
              <th className="py-1.5 pl-3 text-right font-normal">{config.columnaImporte}</th>
            </tr>
          </thead>
          <tbody>
            {afectacion.detalle.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-4 text-center">
                  Sin cuentas asignadas
                </td>
              </tr>
            ) : (
              afectacion.detalle.map((line, index) => (
                <tr key={index} className="align-top">
                  <td className="whitespace-nowrap py-1.5 pr-3">
                    {formatCodigoCuenta(line.cuenta_codigo || '—')}
                  </td>
                  <td className="px-2 py-1.5">
                    {line.descripcion?.trim() || line.cuenta_descripcion || '—'}
                  </td>
                  <td className="py-1.5 pl-3 text-right">
                    <ImporteConLetras
                      valor={line.importe}
                      mostrarLetras={Boolean(config.mostrarImporteLetrasDetalle)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </OverlayField>

      <OverlayField
        editId="total"
        pos={campos.total}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'total'}
        onPointerDownField={handlePointerDownField}
      >
        <div className="border-t border-black pt-2">
          <span>{config.etiquetaTotal}</span>{' '}
          <ImporteConLetras
            valor={total}
            mostrarLetras={Boolean(config.mostrarImporteLetrasTotal)}
          />
        </div>
      </OverlayField>

      <OverlayField
        editId="pie"
        pos={campos.pie}
        config={config}
        preview={preview}
        interactive={interactive}
        selected={selectedId === 'pie'}
        onPointerDownField={handlePointerDownField}
      >
        <footer className="afectacion-print-pie">
          {config.pieDepartamento}
          {config.mostrarFechaPie
            ? `, ${formatFechaPie(afectacion.fecha, config.formatoFecha)}`
            : ''}
        </footer>
      </OverlayField>

      {showFirmaSello && (
        <OverlayField
          editId="firmaSello"
          pos={campos.firmaSello}
          config={config}
          preview={preview}
          interactive={interactive}
          selected={selectedId === 'firmaSello'}
          ghost={!config.mostrarFirmaSello}
          onPointerDownField={handlePointerDownField}
        >
          {config.firmaSelloDataUrl && config.mostrarFirmaSello ? (
            <img
              src={config.firmaSelloDataUrl}
              alt="Firma y sello"
              className="h-full w-full object-contain"
              draggable={false}
            />
          ) : (
            interactive && (
              <div className="flex h-full w-full items-center justify-center border border-dashed border-black/40 text-center text-black/50">
                Firma / sello
              </div>
            )
          )}
        </OverlayField>
      )}
    </div>
  );
}
