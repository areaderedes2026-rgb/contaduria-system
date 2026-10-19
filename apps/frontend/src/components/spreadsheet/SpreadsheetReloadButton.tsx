import { RefreshCw } from 'lucide-react';

interface SpreadsheetReloadButtonProps {
  onReload: () => void;
  loading?: boolean;
  title?: string;
}

/** Botón minimalista para recargar los datos de la tabla. */
export function SpreadsheetReloadButton({
  onReload,
  loading = false,
  title = 'Recargar tabla',
}: SpreadsheetReloadButtonProps) {
  return (
    <button
      type="button"
      onClick={onReload}
      disabled={loading}
      title={title}
      aria-label={title}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
    </button>
  );
}
