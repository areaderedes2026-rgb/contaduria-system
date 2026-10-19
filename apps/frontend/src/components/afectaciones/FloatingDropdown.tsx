import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type RefObject,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export interface DropdownPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

/** Posiciona un listado flotante sobre el input, sin agrandar el modal. */
export function useFloatingDropdown(open: boolean, anchorRef: RefObject<HTMLElement | null>) {
  const [pos, setPos] = useState<DropdownPosition | null>(null);

  const update = useCallback(() => {
    const el = anchorRef.current;
    if (!el || !open) {
      setPos(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - gap - 12;
    const spaceAbove = rect.top - gap - 12;
    const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
    const maxHeight = Math.min(280, Math.max(120, preferBelow ? spaceBelow : spaceAbove));
    const top = preferBelow ? rect.bottom + gap : Math.max(8, rect.top - gap - maxHeight);

    setPos({
      top,
      left: rect.left,
      width: Math.max(rect.width, 300),
      maxHeight,
    });
  }, [anchorRef, open]);

  useLayoutEffect(() => {
    update();
  }, [update, open]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => update();
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, update]);

  return pos;
}

export function FloatingDropdown({
  open,
  pos,
  listId,
  children,
}: {
  open: boolean;
  pos: DropdownPosition | null;
  listId: string;
  children: ReactNode;
}) {
  if (!open || !pos || typeof document === 'undefined') return null;

  // z-index por encima del Modal (z-[100]): ambos son portales hermanos en <body>
  return createPortal(
    <div
      id={listId}
      role="listbox"
      data-floating-dropdown="true"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: pos.width,
        maxHeight: pos.maxHeight,
      }}
      className="z-130 overflow-auto border border-slate-300 bg-white py-0.5 shadow-xl"
    >
      {children}
    </div>,
    document.body
  );
}
