import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsibleStatsProps {
  children: ReactNode;
  defaultOpen?: boolean;
  showLabel?: string;
  hideLabel?: string;
  /** Notifica al padre si el panel está abierto (p. ej. para ajustar gaps). */
  onOpenChange?: (open: boolean) => void;
}

/** Espacio vertical simétrico alrededor del control “Mostrar datos”. */
const TOGGLE_PAD = 'py-2';

/**
 * Panel de tarjetas de resumen: oculto por defecto, se despliega desde arriba
 * con el control centrado “Mostrar datos”.
 */
export function CollapsibleStats({
  children,
  defaultOpen = false,
  showLabel = 'Mostrar datos',
  hideLabel = 'Ocultar datos',
  onOpenChange,
}: CollapsibleStatsProps) {
  const [open, setOpen] = useState(defaultOpen);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      onOpenChange?.(next);
      return next;
    });
  }

  return (
    <div className={`shrink-0 ${open ? 'pt-2' : TOGGLE_PAD}`}>
      <div className="flex justify-center">
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-expanded={open}
        >
          {open ? hideLabel : showLabel}
          {open ? (
            <ChevronUp size={15} className="opacity-70" aria-hidden />
          ) : (
            <ChevronDown size={15} className="opacity-70" aria-hidden />
          )}
        </button>
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={`origin-top pt-2 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              open
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none -translate-y-2 opacity-0'
            }`}
            aria-hidden={!open}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
