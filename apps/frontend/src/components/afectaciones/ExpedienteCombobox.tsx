import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Plus, Search, X } from 'lucide-react';
import { FloatingDropdown, useFloatingDropdown } from '@/components/afectaciones/FloatingDropdown';
import { formatCurrency } from '@/utils/format';
import type { ExpedienteDisponible } from '@/types';

interface ExpedienteComboboxProps {
  value: ExpedienteDisponible | null;
  onChange: (expediente: ExpedienteDisponible | null) => void;
  options: ExpedienteDisponible[];
  loading?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'cell';
  /** Abrir creación de expediente (modal) cuando no hay coincidencias / opción crear. */
  onCreateRequest?: () => void;
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function matchesExpediente(exp: ExpedienteDisponible, q: string) {
  if (!q) return true;
  const needle = normalize(q.trim());
  if (!needle) return true;

  const haystack = normalize(
    `${exp.numero_completo} ${exp.proveedor_nombre} ${exp.detalle} ${exp.importe} ${exp.importe_disponible}`
  );
  const parts = needle.split(/\s+/).filter(Boolean);

  return parts.every((part) => {
    if (haystack.includes(part)) return true;
    const digits = part.replace(/\D/g, '');
    if (digits) {
      const numeroDigits = exp.numero_completo.replace(/\D/g, '');
      if (numeroDigits.includes(digits) || numeroDigits.startsWith(digits)) return true;
    }
    return false;
  });
}

export function ExpedienteCombobox({
  value,
  onChange,
  options,
  loading,
  disabled,
  variant = 'default',
  onCreateRequest,
}: ExpedienteComboboxProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const resultados = useMemo(
    () => options.filter((e) => matchesExpediente(e, query)).slice(0, 50),
    [options, query]
  );

  const canCreate = !!onCreateRequest;
  const showEmptyCreate =
    canCreate && open && !loading && resultados.length === 0 && query.trim().length >= 1;
  const showCreateFooter = canCreate && open && !loading && !showEmptyCreate;
  const optionCount =
    resultados.length + (showEmptyCreate || showCreateFooter ? 1 : 0);

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
  }, [resultados, query]);

  const select = (exp: ExpedienteDisponible) => {
    onChange(exp);
    setQuery('');
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery('');
    setOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const requestCreate = () => {
    setOpen(false);
    setQuery('');
    onCreateRequest?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(optionCount - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight < resultados.length && resultados[highlight]) {
        select(resultados[highlight]);
      } else if (showEmptyCreate || showCreateFooter) {
        requestCreate();
      }
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
            ? 'bg-primary-50/80 px-2 py-1.5'
            : 'rounded-lg border border-primary-200 bg-primary-50/60 px-3 py-2.5'
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-semibold text-primary-900">
              {value.numero_completo}
            </p>
            <p className="mt-0.5 truncate text-xs text-primary-700/80">
              {value.proveedor_nombre} · Disp. {formatCurrency(value.importe_disponible)}
              {' · '}
              {value.afectaciones_activas} afectación
              {value.afectaciones_activas !== 1 ? 'es' : ''}
            </p>
            {value.afectaciones && value.afectaciones.length > 0 && (
              <ul className="mt-1.5 max-h-20 space-y-0.5 overflow-y-auto border-t border-primary-100 pt-1.5 text-[11px] text-primary-800/80">
                {value.afectaciones.map((a) => (
                  <li key={a.id} className="truncate">
                    <span className="font-mono font-medium">{a.numero_completo}</span>
                    {': '}
                    {formatCurrency(a.importe_total)}
                    {a.observaciones ? ` — ${a.observaciones}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="shrink-0 rounded-md p-1 text-primary-600 transition hover:bg-primary-100"
            title="Cambiar expediente"
            aria-label="Cambiar expediente"
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
          placeholder="Buscar por número, proveedor o detalle..."
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
        {resultados.map((exp, index) => (
          <button
            key={exp.id}
            type="button"
            role="option"
            aria-selected={highlight === index}
            onMouseEnter={() => setHighlight(index)}
            onClick={() => select(exp)}
            className={`flex w-full items-start gap-2 px-3 py-2.5 text-left transition ${
              highlight === index ? 'bg-primary-50' : 'hover:bg-slate-50'
            }`}
          >
            <Check
              size={14}
              className={`mt-0.5 shrink-0 ${highlight === index ? 'text-primary-600' : 'text-transparent'}`}
            />
            <span className="min-w-0">
              <span className="block truncate font-mono text-sm font-medium text-slate-800">
                {exp.numero_completo}
              </span>
              <span className="block truncate text-xs text-slate-500">
                {exp.proveedor_nombre} · {formatCurrency(exp.importe)}
                {exp.importe_disponible > 0
                  ? ` · Disp. ${formatCurrency(exp.importe_disponible)}`
                  : ' · Sin saldo disp.'}
                {` · ${exp.afectaciones_activas} afect.`}
              </span>
            </span>
          </button>
        ))}

        {showEmptyCreate && (
          <button
            type="button"
            role="option"
            aria-selected={highlight === 0}
            onMouseEnter={() => setHighlight(0)}
            onClick={requestCreate}
            className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm ${
              highlight === 0 ? 'bg-primary-50 text-primary-800' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Plus size={15} className="shrink-0 text-primary-600" />
            <span>
              No hay coincidencias. Crear expediente
              {query.trim() ? (
                <>
                  {' '}
                  <strong>&ldquo;{query.trim()}&rdquo;</strong>
                </>
              ) : null}
            </span>
          </button>
        )}

        {showCreateFooter && (
          <button
            type="button"
            role="option"
            aria-selected={highlight === resultados.length}
            onMouseEnter={() => setHighlight(resultados.length)}
            onClick={requestCreate}
            className={`flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-sm ${
              highlight === resultados.length
                ? 'bg-primary-50 text-primary-800'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Plus size={15} className="shrink-0 text-primary-600" />
            <span>Crear nuevo expediente</span>
          </button>
        )}

        {!loading && !canCreate && resultados.length === 0 && (
          <p className="px-3 py-3 text-sm text-slate-500">
            {query.trim()
              ? 'Sin expedientes que coincidan con la búsqueda.'
              : options.length === 0
                ? 'No hay expedientes disponibles para afectar.'
                : 'Escribí para filtrar o elegí de la lista.'}
          </p>
        )}

        {!loading && canCreate && !query.trim() && resultados.length === 0 && options.length === 0 && (
          <p className="px-3 py-2 text-sm text-slate-500">
            No hay expedientes disponibles. Creá uno nuevo para continuar.
          </p>
        )}

        {!loading && !query.trim() && resultados.length > 0 && !canCreate && (
          <p className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-400">
            {resultados.length} expediente{resultados.length !== 1 ? 's' : ''} disponible
            {resultados.length !== 1 ? 's' : ''}
          </p>
        )}
      </FloatingDropdown>
    </div>
  );
}
