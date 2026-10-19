import type { ReactNode } from 'react';
import { Download, Plus } from 'lucide-react';

interface SpreadsheetActionsProps {
  onExport?: () => void;
  exporting?: boolean;
  exportLabel?: string;
  onNew?: () => void;
  newLabel?: string;
  canWrite?: boolean;
  extra?: ReactNode;
}

export function SpreadsheetTitleActions({
  onExport,
  exporting,
  exportLabel = 'Exportar',
  onNew,
  newLabel = 'Nuevo',
  canWrite = true,
  extra,
}: SpreadsheetActionsProps) {
  return (
    <>
      {onExport && (
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-primary-100 transition-colors hover:bg-primary-800 hover:text-white disabled:opacity-50"
        >
          <Download size={16} />
          {exporting ? 'Exportando...' : exportLabel}
        </button>
      )}
      {extra}
      {canWrite && onNew && (
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          <Plus size={16} />
          {newLabel}
        </button>
      )}
    </>
  );
}
