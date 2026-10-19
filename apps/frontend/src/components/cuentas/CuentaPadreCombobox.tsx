import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import { FloatingDropdown, useFloatingDropdown } from '@/components/afectaciones/FloatingDropdown';
import type { CuentaPadreOption } from '@/types';

interface CuentaPadreComboboxProps {
  value: CuentaPadreOption | null;
  onChange: (padre: CuentaPadreOption | null) => void;
  options: CuentaPadreOption[];
  loading?: boolean;
  disabled?: boolean;
  excludeId?: number;
  variant?: 'default' | 'cell';
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function matchesPadre(padre: CuentaPadreOption, q: string) {
  if (!q.trim()) return true;
  const needle = normalize(q.trim());
  const haystack = normalize(`${padre.codigo} ${padre.descripcion}`);
  return needle.split(/\s+/).every((part) => haystack.includes(part));
}

export function CuentaPadreCombobox({
  value,
  onChange,
  options,
  loading,
  disabled,
  excludeId,
  variant = 'default',
}: CuentaPadreComboboxProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const disponibles = useMemo(
    () => options.filter((p) => p.id !== excludeId),
    [options, excludeId]
  );

  const resultados = useMemo(
    () => disponibles.filter((p) => matchesPadre(p, query)).slice(0, 40),
    [disponibles, query]
  );

  const pos = useFloatingDropdown(open && !value, containerRef);
  const isCell = variant === 'cell';

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

  const select = (padre: CuentaPadreOption | null) => {
    onChange(padre);
    setQuery('');
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery('');
    setOpen(false);
  };

  if (value) {
    return (
      <div
        className={
          isCell
            ? 'bg-primary-50/80 px-2 py-1.5'
            : 'rounded-lg border border-primary-200 bg-primary-50/60 px-3 py-2.5'
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-semibold text-primary-900">
              {value.codigo}
            </p>
            <p className="mt-0.5 truncate text-xs text-primary-700/80">{value.descripcion}</p>
          </div>
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="shrink-0 rounded-md p-1 text-primary-600 transition hover:bg-primary-100"
            title="Quitar cuenta padre"
            aria-label="Quitar cuenta padre"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          ref={inputRef}
          value={query}
          disabled={disabled}
          placeholder="Buscar padre por código o descripción..."
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, resultados.length));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (highlight === 0) select(null);
              else if (resultados[highlight - 1]) select(resultados[highlight - 1]);
            } else if (e.key === 'Escape') {
              // No dejar que el Modal contenedor también se cierre
              e.stopPropagation();
              setOpen(false);
              setQuery('');
            }
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className={
            isCell
              ? 'h-9 w-full border-0 bg-transparent py-1.5 pl-8 pr-2 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500/40'
              : 'h-10 w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
          }
        />
        {loading && (
          <Loader2
            size={14}
            className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
          />
        )}
      </div>

      <FloatingDropdown open={open} pos={pos} listId={listId}>
        <button
          type="button"
          role="option"
          aria-selected={highlight === 0}
          onMouseEnter={() => setHighlight(0)}
          onClick={() => select(null)}
          className={`flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-left text-sm transition ${
            highlight === 0 ? 'bg-primary-50' : 'hover:bg-slate-50'
          }`}
        >
          <Check
            size={14}
            className={`shrink-0 ${highlight === 0 ? 'text-primary-600' : 'text-transparent'}`}
          />
          <span className="font-medium text-slate-700">Sin cuenta padre (nivel raíz)</span>
        </button>

        {resultados.map((padre, index) => (
          <button
            key={padre.id}
            type="button"
            role="option"
            aria-selected={highlight === index + 1}
            onMouseEnter={() => setHighlight(index + 1)}
            onClick={() => select(padre)}
            className={`flex w-full items-start gap-2 px-3 py-2.5 text-left transition ${
              highlight === index + 1 ? 'bg-primary-50' : 'hover:bg-slate-50'
            }`}
          >
            <Check
              size={14}
              className={`mt-0.5 shrink-0 ${
                highlight === index + 1 ? 'text-primary-600' : 'text-transparent'
              }`}
            />
            <span className="min-w-0">
              <span className="block truncate font-mono text-sm font-medium text-slate-800">
                {padre.codigo}
              </span>
              <span className="block truncate text-xs text-slate-500">{padre.descripcion}</span>
            </span>
          </button>
        ))}

        {!loading && resultados.length === 0 && query.trim() && (
          <p className="px-3 py-3 text-center text-xs text-slate-500">
            No hay cuentas que coincidan con “{query.trim()}”
          </p>
        )}

        <div className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-400">
          {disponibles.length} cuenta{disponibles.length !== 1 ? 's' : ''} disponible
          {disponibles.length !== 1 ? 's' : ''} como padre
        </div>
      </FloatingDropdown>
    </div>
  );
}
