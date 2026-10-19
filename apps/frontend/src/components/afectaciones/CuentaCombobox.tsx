import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import { FloatingDropdown, useFloatingDropdown } from '@/components/afectaciones/FloatingDropdown';
import { formatCurrency } from '@/utils/format';
import type { CuentaDisponible } from '@/types';

interface CuentaComboboxProps {
  value: CuentaDisponible | null;
  onChange: (cuenta: CuentaDisponible | null) => void;
  options: CuentaDisponible[];
  loading?: boolean;
  disabled?: boolean;
  excludeIds?: number[];
  variant?: 'default' | 'cell';
  placeholder?: string;
  /** Enfoca el input y abre el listado (p. ej. al agregar una fila nueva). */
  autoFocus?: boolean;
  /** Cambia para re-disparar el foco aunque autoFocus ya fuera true. */
  autoFocusKey?: number | string;
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function matchesCuenta(cuenta: CuentaDisponible, q: string) {
  if (!q.trim()) return true;
  const needle = normalize(q.trim());
  const haystack = normalize(`${cuenta.codigo} ${cuenta.descripcion}`);
  return needle.split(/\s+/).every((part) => haystack.includes(part));
}

export function CuentaCombobox({
  value,
  onChange,
  options,
  loading,
  disabled,
  excludeIds = [],
  variant = 'default',
  placeholder = 'Buscar cuenta por código o descripción...',
  autoFocus = false,
  autoFocusKey,
}: CuentaComboboxProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const disponibles = useMemo(
    () =>
      options.filter((c) => !excludeIds.includes(c.id) || (value && c.id === value.id)),
    [options, excludeIds, value]
  );

  const resultados = useMemo(
    () => disponibles.filter((c) => matchesCuenta(c, query)).slice(0, 50),
    [disponibles, query]
  );

  const pos = useFloatingDropdown(open && !value, containerRef);

  useEffect(() => {
    if (!autoFocus || value || disabled) return;
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      setOpen(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [autoFocus, autoFocusKey, value, disabled]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      const portal = document.getElementById(listId);
      if (portal?.contains(target)) return;
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [listId]);

  useEffect(() => {
    setHighlight(0);
  }, [resultados, query]);

  const select = (cuenta: CuentaDisponible) => {
    onChange(cuenta);
    setQuery('');
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery('');
    setOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(resultados.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (resultados[highlight]) select(resultados[highlight]);
    } else if (e.key === 'Escape') {
      // No dejar que el Modal contenedor también se cierre
      e.stopPropagation();
      setOpen(false);
      setQuery('');
    }
  };

  const isCell = variant === 'cell';

  if (value) {
    return (
      <div
        className={
          isCell
            ? 'flex h-full min-h-9 items-center bg-primary-50/80 px-2 py-1'
            : 'rounded-lg border border-primary-200 bg-primary-50/60 px-3 py-2'
        }
      >
        <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-semibold text-primary-900">{value.codigo}</p>
            <p className="truncate text-[11px] text-primary-700/80">
              {value.descripcion} · Disp. {formatCurrency(value.saldo_disponible)}
            </p>
          </div>
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="shrink-0 rounded p-0.5 text-primary-600 transition hover:bg-primary-100"
            title="Cambiar cuenta"
            aria-label="Cambiar cuenta"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          size={14}
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${isCell ? 'left-2' : 'left-3'}`}
        />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={
            isCell
              ? 'h-9 w-full border-0 bg-transparent py-1.5 pl-7 pr-7 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500/40'
              : 'w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-9 text-sm shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
          }
        />
        {loading && (
          <Loader2
            size={14}
            className={`absolute top-1/2 -translate-y-1/2 animate-spin text-slate-400 ${isCell ? 'right-2' : 'right-3'}`}
          />
        )}
      </div>

      <FloatingDropdown open={open} pos={pos} listId={listId}>
          {resultados.map((cuenta, index) => (
            <button
              key={cuenta.id}
              type="button"
              role="option"
              aria-selected={highlight === index}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => select(cuenta)}
              className={`flex w-full items-start gap-2 px-3 py-2 text-left transition ${
                highlight === index ? 'bg-primary-50' : 'hover:bg-slate-50'
              }`}
            >
              <Check
                size={14}
                className={`mt-0.5 shrink-0 ${highlight === index ? 'text-primary-600' : 'text-transparent'}`}
              />
              <span className="min-w-0">
                <span className="block truncate font-mono text-sm font-medium text-slate-800">
                  {cuenta.codigo}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {cuenta.descripcion} · Disp. {formatCurrency(cuenta.saldo_disponible)}
                </span>
              </span>
            </button>
          ))}

          {!loading && resultados.length === 0 && (
            <p className="px-3 py-3 text-sm text-slate-500">
              {query.trim()
                ? 'Sin cuentas que coincidan.'
                : disponibles.length === 0
                  ? 'No hay cuentas con saldo disponible.'
                  : 'Escribí para filtrar cuentas.'}
            </p>
          )}
      </FloatingDropdown>
    </div>
  );
}
