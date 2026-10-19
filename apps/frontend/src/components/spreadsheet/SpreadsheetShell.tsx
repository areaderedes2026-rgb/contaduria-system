import type { ReactNode } from 'react';
import { spreadsheet } from './spreadsheet.styles';

interface SpreadsheetShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  filters?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /**
   * Ocupa el alto del contenedor padre y deja un único scroll en la grilla
   * (título, filtros y pie quedan fijos).
   */
  fillHeight?: boolean;
}

export function SpreadsheetShell({
  title,
  subtitle,
  actions,
  toolbar,
  filters,
  footer,
  children,
  fillHeight = false,
}: SpreadsheetShellProps) {
  return (
    <div className={fillHeight ? 'flex h-full min-h-0 flex-col' : undefined}>
      <div
        className={`${spreadsheet.shell} ${
          fillHeight ? 'h-full min-h-0 overflow-hidden' : 'overflow-visible'
        }`}
      >
        <div className={`${spreadsheet.titleBar} shrink-0`}>
          <div>
            <p className={spreadsheet.titleText}>{title}</p>
            {subtitle && <p className={spreadsheet.titleSubtext}>{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
        </div>

        {toolbar && <div className={`${spreadsheet.toolbar} relative z-30 shrink-0`}>{toolbar}</div>}
        {filters && (
          <div className={`${spreadsheet.filterBar} relative z-30 shrink-0`}>{filters}</div>
        )}

        <div
          className={
            fillHeight
              ? // -mt-px solapa 1px bajo filtros/toolbar para que no se vean filas en el hueco sticky
                `min-h-0 flex-1 overflow-auto ${filters || toolbar ? '-mt-px' : ''}`
              : // Sin overflow: en PWA/iOS overflow-x-auto atrapa el scroll vertical del detalle
                `${filters || toolbar ? '-mt-px' : ''}`
          }
        >
          {children}
        </div>

        {footer && <div className={`${spreadsheet.statusBar} shrink-0`}>{footer}</div>}
      </div>
    </div>
  );
}
