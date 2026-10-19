import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Contenido a la derecha del título, en la misma fila del encabezado. */
  headerExtra?: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  flush?: boolean;
  /**
   * Nivel de apilamiento (0 = base). Usar 1+ para modales encima de otro modal
   * (p. ej. crear expediente desde afectación).
   */
  stackLevel?: number;
}

const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  '2xl': 'max-w-[92vw] xl:max-w-7xl',
};

/** Pila de cierres: Escape solo cierra el modal superior. */
const escapeStack: Array<() => void> = [];

export function Modal({
  open,
  onClose,
  title,
  headerExtra,
  children,
  size = 'md',
  flush = false,
  stackLevel = 0,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const closeTop = () => onClose();
    escapeStack.push(closeTop);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      const top = escapeStack[escapeStack.length - 1];
      if (top === closeTop) {
        event.preventDefault();
        top();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      const idx = escapeStack.lastIndexOf(closeTop);
      if (idx >= 0) escapeStack.splice(idx, 1);
      window.removeEventListener('keydown', onKeyDown);
      if (escapeStack.length === 0) {
        document.body.style.overflow = prevOverflow;
      }
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const zClass = stackLevel <= 0 ? 'z-[100]' : stackLevel === 1 ? 'z-[120]' : 'z-[140]';

  return createPortal(
    <div
      className={`fixed inset-0 ${zClass} flex items-center justify-center p-3 sm:p-4`}
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative flex max-h-[min(96vh,980px)] w-full flex-col ${SIZE_CLASS[size]} overflow-hidden rounded-none bg-white shadow-2xl`}
      >
        <div className="flex shrink-0 items-center gap-3 bg-primary-950 px-4 py-3 sm:gap-4 sm:px-5">
          <h2 id="modal-title" className="shrink-0 text-base font-semibold text-white sm:text-lg">
            {title}
          </h2>
          {headerExtra}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto shrink-0 rounded-md p-1 text-primary-200 transition-colors hover:bg-primary-800 hover:text-white"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto ${flush ? '' : 'p-6'}`}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
