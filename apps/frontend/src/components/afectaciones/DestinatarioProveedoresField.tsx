import { useEffect, useRef } from 'react';
import { formatProveedoresNombres } from '@/utils/proveedores';
import type { ExpedienteProveedorRef } from '@/types';

interface DestinatarioProveedoresFieldProps {
  options: ExpedienteProveedorRef[];
  selectedIds: number[];
  onChange: (selectedIds: number[], destinatario: string) => void;
  disabled?: boolean;
  /** Ref para enfocar el primer chip al seleccionar un expediente multi-proveedor. */
  focusRef?: React.RefObject<HTMLButtonElement | null>;
  variant?: 'default' | 'cell';
}

/**
 * Selección rápida de destinatarios (chips) a partir de los proveedores del expediente.
 * El texto resultante se guarda en afectaciones.destinatario.
 */
export function DestinatarioProveedoresField({
  options,
  selectedIds,
  onChange,
  disabled,
  focusRef,
  variant = 'cell',
}: DestinatarioProveedoresFieldProps) {
  const firstBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!focusRef) return;
    (focusRef as React.MutableRefObject<HTMLButtonElement | null>).current = firstBtnRef.current;
  });

  const emit = (ids: number[]) => {
    const names = options.filter((p) => ids.includes(p.id));
    onChange(ids, formatProveedoresNombres(names));
  };

  const toggle = (id: number) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length <= 1) return;
      emit(selectedIds.filter((x) => x !== id));
      return;
    }
    emit([...selectedIds, id]);
  };

  const isCell = variant === 'cell';

  return (
    <div className="space-y-1">
      <div
        className={
          isCell
            ? 'flex min-h-9 flex-wrap items-center gap-1.5 px-1 py-1'
            : 'flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5'
        }
      >
        {options.map((p, index) => {
          const selected = selectedIds.includes(p.id);
          return (
            <button
              key={p.id}
              ref={index === 0 ? firstBtnRef : undefined}
              type="button"
              disabled={disabled || (selected && selectedIds.length <= 1)}
              onClick={() => toggle(p.id)}
              title={
                selected
                  ? selectedIds.length <= 1
                    ? 'Debe quedar al menos un destinatario'
                    : 'Quitar de la afectación'
                  : 'Incluir en la afectación'
              }
              className={`inline-flex max-w-full items-center rounded-md px-2.5 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-primary-500/50 disabled:cursor-not-allowed ${
                selected
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'border border-dashed border-slate-300 bg-white text-slate-600 hover:border-primary-400 hover:bg-primary-50 hover:text-primary-800'
              }`}
            >
              <span className="truncate">{p.nombre}</span>
            </button>
          );
        })}

        {options.length === 0 && (
          <span className="px-1 text-sm text-slate-400">Sin proveedores en el expediente</span>
        )}
      </div>

      {selectedIds.length === 0 && options.length > 0 && (
        <p className="px-1 text-[11px] text-amber-700">
          Seleccione al menos un proveedor destinatario
        </p>
      )}
    </div>
  );
}
