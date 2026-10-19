import { Fragment, type ReactNode } from 'react';
import { Alert } from '@/components/ui/Alert';
import { spreadsheet } from './spreadsheet.styles';

export const cellInput =
  'h-9 w-full min-w-0 rounded-none border-0 bg-transparent px-2 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500/40 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

export const cellTextarea =
  'w-full min-w-0 resize-none rounded-none border-0 bg-transparent px-2 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500/40';

export const cellSelect = `${cellInput} cursor-pointer appearance-none bg-white pr-7`;

export const labelCell = `${spreadsheet.headerCell} w-[34%] max-w-[190px] bg-[#f1f5f9] font-medium text-slate-600`;

export interface SpreadsheetField {
  label: ReactNode;
  children: ReactNode;
  /** Ocupa el ancho completo (ambas columnas) en escritorio. */
  full?: boolean;
  alignTop?: boolean;
  hidden?: boolean;
}

/**
 * Grilla de campos tipo Excel.
 * - `grid` (default): 2 columnas (etiqueta|valor) en escritorio; 1 en móvil.
 * - `stack`: un campo por fila, más separación visual entre casilleros.
 */
export function SpreadsheetFieldGrid({
  fields,
  layout = 'grid',
}: {
  fields: SpreadsheetField[];
  layout?: 'grid' | 'stack';
}) {
  const visible = fields.filter((f) => !f.hidden);

  if (layout === 'stack') {
    const stackLabel = `${spreadsheet.headerCell} w-[28%] min-w-[120px] max-w-[200px] bg-[#e8eef4] font-semibold text-slate-700`;
    const stackValue = 'border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 align-middle';

    return (
      <div className="overflow-x-auto">
        <table className={`${spreadsheet.table} border-t-2 border-slate-400`}>
          <tbody>
            {visible.map((field, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}>
                <td
                  className={`${stackLabel} border-b-2 border-slate-300 ${field.alignTop ? 'align-top' : ''}`}
                >
                  {field.label}
                </td>
                <td className={`${stackValue} border-b-2 border-slate-300`}>
                  {field.children}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const rows: SpreadsheetField[][] = [];
  let current: SpreadsheetField[] = [];
  for (const field of visible) {
    if (field.full) {
      if (current.length) {
        rows.push(current);
        current = [];
      }
      rows.push([field]);
    } else {
      current.push(field);
      if (current.length === 2) {
        rows.push(current);
        current = [];
      }
    }
  }
  if (current.length) rows.push(current);

  return (
    <div className="overflow-x-auto md:overflow-visible">
      {/* Escritorio: grilla 2×2 tipo Excel */}
      <table className={`${spreadsheet.table} hidden min-w-[640px] md:table`}>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.length === 1 ? (
                <>
                  <td className={`${labelCell} ${row[0].alignTop ? 'align-top' : ''}`}>{row[0].label}</td>
                  <td className={spreadsheet.bodyCell} colSpan={3}>
                    {row[0].children}
                  </td>
                </>
              ) : (
                row.map((field, j) => (
                  <Fragment key={j}>
                    <td className={`${labelCell} ${field.alignTop ? 'align-top' : ''}`}>{field.label}</td>
                    <td className={spreadsheet.bodyCell}>{field.children}</td>
                  </Fragment>
                ))
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Móvil: una columna etiqueta | valor */}
      <table className={`${spreadsheet.table} md:hidden`}>
        <tbody>
          {visible.map((field, i) => (
            <tr key={i}>
              <td className={`${labelCell} ${field.alignTop ? 'align-top' : ''}`}>{field.label}</td>
              <td className={spreadsheet.bodyCell}>{field.children}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Barra superior con instrucciones dentro de un modal flush. */
export function SpreadsheetFormHint({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-slate-200 bg-[#f9f9f9] px-4 py-2.5 text-xs text-slate-600">
      {children}
    </div>
  );
}

/** Barra de error dentro de un modal flush. */
export function SpreadsheetFormError({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-red-200 bg-red-50 px-4 py-3">
      <Alert type="error">{children}</Alert>
    </div>
  );
}

/** Sección con encabezado tipo Excel (para detalles, totales, etc.). */
export function SpreadsheetFormSection({
  title,
  action,
  children,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-slate-200">
      <div className="flex items-center justify-between gap-2 bg-[#e2e8f0] px-4 py-2">
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        {action}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

/** Pie de formulario con información a la izquierda y acciones a la derecha. */
export function SpreadsheetFormFooter({
  info,
  children,
}: {
  info?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`${spreadsheet.statusBar} flex-wrap gap-y-2`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm">{info}</div>
      <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">{children}</div>
    </div>
  );
}
