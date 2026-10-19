import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import { FloatingDropdown, useFloatingDropdown } from '@/components/afectaciones/FloatingDropdown';
import { formatCurrency } from '@/utils/format';
import type { AfectacionDisponibleLibramiento } from '@/types';

interface AfectacionLibramientoComboboxProps {
  value: AfectacionDisponibleLibramiento | null;
  onChange: (afectacion: AfectacionDisponibleLibramiento | null) => void;
  options: AfectacionDisponibleLibramiento[];
  loading?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'cell';
}

type FlatResult =
  | { kind: 'group'; key: string; label: string; sub: string }
  | { kind: 'item'; af: AfectacionDisponibleLibramiento; flatIndex: number };

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function matchesAfectacion(af: AfectacionDisponibleLibramiento, q: string) {
  if (!q) return true;
  const needle = normalize(q.trim());
  if (!needle) return true;

  const haystack = normalize(
    `${af.numero_completo} ${af.expediente_numero} ${af.destinatario} ${af.proveedor_nombre} ${af.expediente_detalle} ${af.importe_total}`
  );
  const parts = needle.split(/\s+/).filter(Boolean);

  return parts.every((part) => {
    if (haystack.includes(part)) return true;
    const digits = part.replace(/\D/g, '');
    if (digits) {
      const afDigits = af.numero_completo.replace(/\D/g, '');
      const expDigits = af.expediente_numero.replace(/\D/g, '');
      if (afDigits.includes(digits) || expDigits.includes(digits)) return true;
    }
    return false;
  });
}

/** Agrupa resultados por expediente para buscar tanto por Nº de afectación como por expediente. */
function buildGroupedResults(filtered: AfectacionDisponibleLibramiento[]): {
  rows: FlatResult[];
  selectable: AfectacionDisponibleLibramiento[];
} {
  const byExp = new Map<number, AfectacionDisponibleLibramiento[]>();
  for (const af of filtered) {
    const list = byExp.get(af.expediente_id) ?? [];
    list.push(af);
    byExp.set(af.expediente_id, list);
  }

  const rows: FlatResult[] = [];
  const selectable: AfectacionDisponibleLibramiento[] = [];
  let flatIndex = 0;

  const groups = Array.from(byExp.entries()).sort((a, b) =>
    b[1][0].expediente_numero.localeCompare(a[1][0].expediente_numero, 'es')
  );

  for (const [, list] of groups) {
    const first = list[0];
    rows.push({
      kind: 'group',
      key: `exp-${first.expediente_id}`,
      label: `Exp. ${first.expediente_numero}`,
      sub: first.proveedor_nombre,
    });
    for (const af of list) {
      rows.push({ kind: 'item', af, flatIndex });
      selectable.push(af);
      flatIndex += 1;
    }
  }

  return { rows, selectable };
}

export function AfectacionLibramientoCombobox({
  value,
  onChange,
  options,
  loading,
  disabled,
  variant = 'default',
}: AfectacionLibramientoComboboxProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const filtered = useMemo(
    () => options.filter((a) => matchesAfectacion(a, query)).slice(0, 80),
    [options, query]
  );

  const { rows, selectable } = useMemo(() => buildGroupedResults(filtered), [filtered]);

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
  }, [selectable, query]);

  const select = (af: AfectacionDisponibleLibramiento) => {
    onChange(af);
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
      setHighlight((h) => Math.min(h + 1, Math.max(selectable.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectable[highlight]) select(selectable[highlight]);
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
            ? 'flex h-9 items-center justify-between gap-2 bg-primary-50/80 px-2'
            : 'flex items-center justify-between gap-2 rounded-lg border border-primary-200 bg-primary-50/60 px-3 py-2'
        }
      >
        <span className="truncate font-mono text-sm font-semibold text-primary-900">
          {value.numero_completo}
        </span>
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          className="shrink-0 rounded-md p-1 text-primary-600 transition hover:bg-primary-100"
          title="Cambiar afectación"
          aria-label="Cambiar afectación"
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
          placeholder="Nº afectación, expediente o beneficiario..."
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
        {rows.map((row) => {
          if (row.kind === 'group') {
            return (
              <div
                key={row.key}
                className="sticky top-0 border-b border-slate-100 bg-slate-50 px-3 py-1.5"
              >
                <p className="truncate font-mono text-[11px] font-semibold text-slate-700">
                  {row.label}
                </p>
                <p className="truncate text-[10px] text-slate-500">{row.sub}</p>
              </div>
            );
          }

          const { af, flatIndex } = row;
          return (
            <button
              key={af.id}
              type="button"
              role="option"
              aria-selected={highlight === flatIndex}
              onMouseEnter={() => setHighlight(flatIndex)}
              onClick={() => select(af)}
              className={`flex w-full items-center gap-2 px-3 py-2 pl-5 text-left transition ${
                highlight === flatIndex ? 'bg-primary-50' : 'hover:bg-slate-50'
              }`}
            >
              <Check
                size={14}
                className={`shrink-0 ${highlight === flatIndex ? 'text-primary-600' : 'text-transparent'}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-sm font-medium text-slate-800">
                  {af.numero_completo}
                </span>
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-slate-500">
                {formatCurrency(af.importe_total)}
              </span>
            </button>
          );
        })}

        {!loading && selectable.length === 0 && (
          <p className="px-3 py-3 text-sm text-slate-500">
            {query.trim()
              ? 'Sin afectaciones que coincidan con la búsqueda.'
              : options.length === 0
                ? 'No hay afectaciones disponibles para librar.'
                : 'Escribí Nº de afectación, expediente o beneficiario.'}
          </p>
        )}

        {!loading && !query.trim() && selectable.length > 0 && (
          <p className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-400">
            {selectable.length} afectación{selectable.length !== 1 ? 'es' : ''} · agrupadas por
            expediente
          </p>
        )}
      </FloatingDropdown>
    </div>
  );
}
