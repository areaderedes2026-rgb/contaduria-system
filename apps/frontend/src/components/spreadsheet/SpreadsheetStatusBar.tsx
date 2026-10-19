import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SpreadsheetStatusBarProps {
  left?: ReactNode;
  right?: ReactNode;
  page?: number;
  totalPages?: number;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
}

export function SpreadsheetStatusBar({
  left,
  right,
  page,
  totalPages,
  onPrevPage,
  onNextPage,
  canPrev,
  canNext,
}: SpreadsheetStatusBarProps) {
  const showPagination = page !== undefined && totalPages !== undefined;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">{left}</div>
      <div className="flex items-center gap-2">
        {right}
        {showPagination && (
          <div className="flex items-center gap-1.5">
            <span className="tabular-nums">
              Hoja {page} de {totalPages}
            </span>
            <button
              type="button"
              disabled={!canPrev}
              onClick={onPrevPage}
              className="rounded-md border border-slate-300 bg-white p-1 hover:bg-slate-50 disabled:opacity-40"
              title="Página anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={!canNext}
              onClick={onNextPage}
              className="rounded-md border border-slate-300 bg-white p-1 hover:bg-slate-50 disabled:opacity-40"
              title="Página siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
