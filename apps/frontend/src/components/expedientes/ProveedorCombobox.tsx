import { useEffect, useId, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Plus, Search, X } from 'lucide-react';
import { createProveedor, getProveedoresActivos } from '@/services/proveedores.service';
import { ApiClientError } from '@/services/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Button } from '@/components/ui/Button';
import type { Proveedor } from '@/types';

interface ProveedorComboboxProps {
  value: Proveedor | null;
  onChange: (proveedor: Proveedor | null) => void;
  disabled?: boolean;
  /** Estilo plano para casilleros tipo formulario de escritorio. */
  variant?: 'default' | 'cell';
}

export function ProveedorCombobox({
  value,
  onChange,
  disabled,
  variant = 'default',
}: ProveedorComboboxProps) {
  const queryClient = useQueryClient();
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newDocumento, setNewDocumento] = useState('');
  const [createError, setCreateError] = useState('');
  const [highlight, setHighlight] = useState(0);

  const debouncedQuery = useDebouncedValue(query.trim(), 250);

  const { data: resultados = [], isFetching } = useQuery({
    queryKey: ['proveedores-activos', debouncedQuery],
    queryFn: () => getProveedoresActivos(debouncedQuery || undefined),
    enabled: open && !creating,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createProveedor({
        nombre: newNombre.trim(),
        documento: newDocumento.trim() || undefined,
        activo: true,
      }),
    onSuccess: (proveedor) => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      queryClient.invalidateQueries({ queryKey: ['proveedores-activos'] });
      onChange(proveedor);
      setCreating(false);
      setOpen(false);
      setQuery('');
      setCreateError('');
      setNewNombre('');
      setNewDocumento('');
    },
    onError: (err) => {
      setCreateError(err instanceof ApiClientError ? err.message : 'Error al crear el proveedor');
    },
  });

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        if (!creating) setQuery('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [creating]);

  useEffect(() => {
    setHighlight(0);
  }, [resultados, debouncedQuery]);

  const exactMatch = resultados.some(
    (p) => p.nombre.trim().toLowerCase() === query.trim().toLowerCase()
  );
  const canCreateFromQuery = query.trim().length >= 2 && !exactMatch;
  const showEmptyCreate = open && !creating && !isFetching && resultados.length === 0 && query.trim().length >= 1;
  const showCreateOption = open && !creating && canCreateFromQuery;

  const selectProveedor = (proveedor: Proveedor) => {
    onChange(proveedor);
    setQuery('');
    setOpen(false);
    setCreating(false);
  };

  const clearSelection = () => {
    onChange(null);
    setQuery('');
    setOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const startCreate = (nombreSeed?: string) => {
    setCreating(true);
    setOpen(true);
    setNewNombre((nombreSeed ?? query).trim());
    setNewDocumento('');
    setCreateError('');
  };

  const optionCount = resultados.length + (showCreateOption || showEmptyCreate ? 1 : 0);

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
      if (highlight < resultados.length) {
        selectProveedor(resultados[highlight]);
      } else if (showCreateOption || showEmptyCreate) {
        startCreate();
      }
    } else if (e.key === 'Escape') {
      // No dejar que el Modal contenedor también se cierre
      e.stopPropagation();
      setOpen(false);
      setQuery('');
    }
  };

  const isCell = variant === 'cell';

  if (value && !creating) {
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
            <p className="truncate text-sm font-semibold text-primary-900">{value.nombre}</p>
            <p className="mt-0.5 text-xs text-primary-700/80">
              {[value.documento, value.telefono, value.domicilio].filter(Boolean).join(' · ') || 'Proveedor seleccionado'}
            </p>
          </div>
          <button
            type="button"
            onClick={clearSelection}
            disabled={disabled}
            className="shrink-0 rounded-md p-1 text-primary-600 transition hover:bg-primary-100"
            title="Cambiar proveedor"
            aria-label="Cambiar proveedor"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (creating) {
    return (
      <div
        className={
          isCell
            ? 'border border-slate-300 bg-white p-2.5'
            : 'rounded-lg border border-slate-300 bg-white p-3 shadow-sm'
        }
      >
        <p className="mb-2.5 text-sm font-medium text-slate-800">Nuevo proveedor</p>
        {createError && (
          <p className="mb-2 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{createError}</p>
        )}
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Nombre</span>
            <input
              autoFocus
              value={newNombre}
              onChange={(e) => setNewNombre(e.target.value)}
              placeholder="Razón social o nombre"
              className={
                isCell
                  ? 'w-full border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/30'
                  : 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">CUIT / DNI (opcional)</span>
            <input
              value={newDocumento}
              onChange={(e) => setNewDocumento(e.target.value)}
              placeholder="Opcional"
              className={
                isCell
                  ? 'w-full border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/30'
                  : 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
              }
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setCreating(false);
                setCreateError('');
                setOpen(true);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              loading={createMutation.isPending}
              disabled={!newNombre.trim()}
              onClick={() => createMutation.mutate()}
            >
              <Plus size={14} />
              Crear y usar
            </Button>
          </div>
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
          placeholder="Buscar proveedor por nombre o documento..."
          className={
            isCell
              ? 'h-9 w-full border-0 bg-transparent py-1.5 pl-8 pr-8 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500/40'
              : 'w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-9 text-sm shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
          }
        />
        {isFetching && (
          <Loader2
            size={15}
            className={`absolute top-1/2 -translate-y-1/2 animate-spin text-slate-400 ${isCell ? 'right-2' : 'right-3'}`}
          />
        )}
      </div>

      {open && (
        <div
          id={listId}
          role="listbox"
          className={`absolute z-30 mt-0.5 max-h-64 w-full overflow-auto border border-slate-300 bg-white py-0.5 shadow-lg ${
            isCell ? '' : 'mt-1 rounded-lg border-slate-200'
          }`}
        >
          {resultados.map((p, index) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={highlight === index}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => selectProveedor(p)}
              className={`flex w-full items-start gap-2 px-3 py-2.5 text-left transition ${
                highlight === index ? 'bg-primary-50' : 'hover:bg-slate-50'
              }`}
            >
              <Check
                size={14}
                className={`mt-0.5 shrink-0 ${highlight === index ? 'text-primary-600' : 'text-transparent'}`}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-800">{p.nombre}</span>
                {(p.documento || p.telefono) && (
                  <span className="block truncate text-xs text-slate-500">
                    {[p.documento, p.telefono].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
            </button>
          ))}

          {showEmptyCreate && (
            <button
              type="button"
              role="option"
              aria-selected={highlight === 0}
              onMouseEnter={() => setHighlight(0)}
              onClick={() => startCreate()}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm ${
                highlight === 0 ? 'bg-primary-50 text-primary-800' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Plus size={15} className="shrink-0 text-primary-600" />
              <span>
                No hay coincidencias. Crear proveedor
                {query.trim() ? (
                  <>
                    {' '}
                    <strong>&ldquo;{query.trim()}&rdquo;</strong>
                  </>
                ) : null}
              </span>
            </button>
          )}

          {showCreateOption && !showEmptyCreate && (
            <button
              type="button"
              role="option"
              aria-selected={highlight === resultados.length}
              onMouseEnter={() => setHighlight(resultados.length)}
              onClick={() => startCreate()}
              className={`flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-sm ${
                highlight === resultados.length
                  ? 'bg-primary-50 text-primary-800'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Plus size={15} className="shrink-0 text-primary-600" />
              <span>
                Crear proveedor <strong>&ldquo;{query.trim()}&rdquo;</strong>
              </span>
            </button>
          )}

          {!isFetching && resultados.length === 0 && query.trim().length === 0 && (
            <p className="px-3 py-3 text-sm text-slate-500">
              Escribí para buscar, o creá un proveedor nuevo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
