export const spreadsheet = {
  shell: 'flex flex-col rounded-lg border border-slate-300 bg-white shadow-sm',
  titleBar: 'flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-primary-950 px-5 py-3.5',
  titleText: 'text-base font-semibold text-white',
  titleSubtext: 'text-sm text-primary-200',
  toolbar: 'flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2',
  toolbarGroup: 'flex items-center gap-1.5 border-r border-slate-300 pr-3 mr-1 last:border-r-0 last:pr-0 last:mr-0',
  toolbarBtn:
    'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed',
  toolbarBtnPrimary:
    'inline-flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50',
  filterBar: 'flex flex-wrap items-center gap-2.5 border-b border-slate-200 bg-[#f9f9f9] px-3 py-2.5',
  filterInput:
    'h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
  filterSelect:
    'h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
  /** Solo horizontal: en detalle no debe atrapar el scroll vertical (PWA/iOS). */
  gridWrap: 'overflow-x-auto overscroll-x-contain',
  table: 'w-full border-collapse text-left',
  headerCell:
    // box-shadow superior opaco sella el hueco de ~1px entre sticky + border-collapse
    // (sin eso, las filas se ven “pasar” detrás del encabezado al hacer scroll).
    'sticky top-0 z-20 border border-slate-300 bg-[#e2e8f0] px-3 py-2.5 text-sm font-semibold text-slate-700 whitespace-nowrap select-none shadow-[0_-2px_0_0_#e2e8f0]',
  headerBtn: 'inline-flex w-full items-center gap-1.5 hover:text-primary-800',
  bodyCell: 'border border-slate-200 px-3 py-2.5 text-sm text-slate-800 align-middle',
  row: 'transition-colors hover:bg-[#e7f3ff]',
  rowAlt: 'bg-[#fafafa]',
  rowSelected: 'bg-[#cce4f7]',
  rowNumCell:
    'border border-slate-200 bg-[#f1f5f9] px-3 py-2.5 text-center text-sm text-slate-500 font-mono tabular-nums w-12',
  statusBar:
    'flex flex-wrap items-center justify-between gap-3 border-t border-slate-300 bg-[#f1f5f9] px-4 py-2.5 text-sm text-slate-600',
  statCard:
    'flex min-w-0 flex-col rounded-lg border bg-white px-4 py-3.5 text-left transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500/40',
  statCardActive: 'border-primary-500 bg-primary-50 shadow-sm ring-2 ring-primary-500/30',
  statCardInactive: 'border-slate-200 hover:border-primary-300',
  statCardLabel: 'text-sm text-slate-500',
  statCardValue:
    'mt-1 min-w-0 break-words text-lg font-bold leading-snug tabular-nums sm:text-xl lg:text-2xl',
} as const;
