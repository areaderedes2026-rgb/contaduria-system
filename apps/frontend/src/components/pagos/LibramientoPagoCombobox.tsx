import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import { FloatingDropdown, useFloatingDropdown } from '@/components/afectaciones/FloatingDropdown';
import { formatCurrency, formatDate } from '@/utils/format';
import type { LibramientoPendientePago } from '@/types';

interface LibramientoPagoComboboxProps {
  value: LibramientoPendientePago | null;
  onChange: (libramiento: LibramientoPendientePago | null) => void;
  options: LibramientoPendientePago[];
  loading?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'cell';
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function matchesLibramiento(lib: LibramientoPendientePago, q: string) {
  if (!q) return true;
  const needle = normalize(q.trim());
  if (!needle) return true;

  const haystack = normalize(
    `${lib.numero_completo} ${lib.expediente_numero} ${lib.beneficiario} ${lib.afectacion_numero} ${lib.neto}`
  );
  const parts = needle.split(/\s+/).filter(Boolean);

  return parts.every((part) => {
    if (haystack.includes(part)) return true;
    const digits = part.replace(/\D/g, '');
    if (digits) {
      const libDigits = lib.numero_completo.replace(/\D/g, '');
      const expDigits = lib.expediente_numero.replace(/\D/g, '');
      if (libDigits.includes(digits) || expDigits.includes(digits)) return true;
    }
    return false;
  });
}

export function LibramientoPagoCombobox({
  value,
  onChange,
  options,
  loading,
  disabled,
  variant = 'default',
}: LibramientoPagoComboboxProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const filtered = useMemo(
    () => options.filter((l) => matchesLibramiento(l, query)).slice(0, 80),
    [options, query]
  );

  const pos = useFloatingDropdown(open && !value, containerRef);

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
  }, [filtered, query]);

  const select = (lib: LibramientoPendientePago) => {
    onChange(lib);
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
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlight]) select(filtered[highlight]);
    } else if (e.key === 'Escape') {
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
            ? 'flex min-h-9 items-center justify-between gap-2 bg-primary-50/80 px-2 py-1'
            : 'flex items-center justify-between gap-2 rounded-lg border border-primary-200 bg-primary-50/60 px-3 py-2'
        }
      >
        <div className="min-w-0">
          <span className="block truncate font-mono text-sm font-semibold text-primary-900">
            {value.numero_completo}
          </span>
          <span className="block truncate text-[11px] text-primary-700/80">
            Exp. {value.expediente_numero} ·{' '}
            {formatCurrency(value.saldo_pendiente ?? value.neto)}
            {(value.monto_pagado ?? 0) > 0.01 ? ' (saldo)' : ''}
          </span>
        </div>
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          className="shrink-0 rounded-md p-1 text-primary-600 transition hover:bg-primary-100"
          title="Cambiar libramiento"
          aria-label="Cambiar libramiento"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          size={15}
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
          placeholder="Nº libramiento, expediente o beneficiario..."
          className={
            isCell
              ? 'h-9 w-full border-0 bg-transparent py-1.5 pl-8 pr-8 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500/40'
              : 'w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-9 text-sm shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
          }
        />
        {loading && (
          <Loader2
            size={15}
            className={`absolute top-1/2 -translate-y-1/2 animate-spin text-slate-400 ${isCell ? 'right-2' : 'right-3'}`}
          />
        )}
      </div>

      <FloatingDropdown open={open} pos={pos} listId={listId}>
        {filtered.map((lib, index) => (
          <button
            key={lib.id}
            type="button"
            role="option"
            aria-selected={highlight === index}
            onMouseEnter={() => setHighlight(index)}
            onClick={() => select(lib)}
            className={`flex w-full items-start gap-2 px-3 py-2 text-left transition ${
              highlight === index ? 'bg-primary-50' : 'hover:bg-slate-50'
            }`}
          >
            <Check
              size={14}
              className={`mt-0.5 shrink-0 ${highlight === index ? 'text-primary-600' : 'text-transparent'}`}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-sm font-medium text-slate-800">
                {lib.numero_completo}
              </span>
              <span className="block truncate text-[11px] text-slate-500">
                Exp. {lib.expediente_numero} · {lib.beneficiario} · {formatDate(lib.fecha)}
              </span>
            </span>
            <span className="shrink-0 font-mono text-xs tabular-nums text-emerald-700">
              {formatCurrency(lib.saldo_pendiente ?? lib.neto)}
            </span>
          </button>
        ))}

        {!loading && filtered.length === 0 && (
          <p className="px-3 py-3 text-sm text-slate-500">
            {query.trim()
              ? 'Sin libramientos que coincidan con la búsqueda.'
              : options.length === 0
                ? 'No hay libramientos pendientes de pago.'
                : 'Escribí Nº de libramiento, expediente o beneficiario.'}
          </p>
        )}

        {!loading && !query.trim() && filtered.length > 0 && (
          <p className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-400">
            {filtered.length} libramiento{filtered.length !== 1 ? 's' : ''} pendiente
            {filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </FloatingDropdown>
    </div>
  );
}
