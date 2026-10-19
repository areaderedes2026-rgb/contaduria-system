import { useEffect, useId, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Plus, Search, X } from 'lucide-react';
import { createProveedor, getProveedoresActivos } from '@/services/proveedores.service';
import { ApiClientError } from '@/services/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Button } from '@/components/ui/Button';
import type { Proveedor } from '@/types';

export const MAX_PROVEEDORES_EXPEDIENTE = 5;

interface ProveedorMultiComboboxProps {
  value: Proveedor[];
  onChange: (proveedores: Proveedor[]) => void;
  disabled?: boolean;
  variant?: 'default' | 'cell';
  max?: number;
}

export function ProveedorMultiCombobox({
  value,
  onChange,
  disabled,
  variant = 'default',
  max = MAX_PROVEEDORES_EXPEDIENTE,
}: ProveedorMultiComboboxProps) {
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
  const atLimit = value.length >= max;
  const selectedIds = new Set(value.map((p) => p.id));

  const { data: resultados = [], isFetching } = useQuery({
    queryKey: ['proveedores-activos', debouncedQuery],
    queryFn: () => getProveedoresActivos(debouncedQuery || undefined),
    enabled: open && !creating && !atLimit,
  });

  const disponibles = resultados.filter((p) => !selectedIds.has(p.id));

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
      if (value.length < max && !selectedIds.has(proveedor.id)) {
        onChange([...value, proveedor]);
      }
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
  }, [disponibles, debouncedQuery]);

  const exactMatch = disponibles.some(
    (p) => p.nombre.trim().toLowerCase() === query.trim().toLowerCase()
  );
  const canCreateFromQuery = !atLimit && query.trim().length >= 2 && !exactMatch;
  const showEmptyCreate =
    open && !creating && !atLimit && !isFetching && disponibles.length === 0 && query.trim().length >= 1;
  const showCreateOption = open && !creating && canCreateFromQuery;
  const optionCount = disponibles.length + (showCreateOption || showEmptyCreate ? 1 : 0);

  const addProveedor = (proveedor: Proveedor) => {
    if (atLimit || selectedIds.has(proveedor.id)) return;
    onChange([...value, proveedor]);
    setQuery('');
    setOpen(value.length + 1 < max);
    if (value.length + 1 < max) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const removeProveedor = (id: number) => {
    onChange(value.filter((p) => p.id !== id));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const startCreate = (nombreSeed?: string) => {
    if (atLimit) return;
    setCreating(true);
    setOpen(true);
    setNewNombre((nombreSeed ?? query).trim());
    setNewDocumento('');
    setCreateError('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !query && value.length > 0) {
      removeProveedor(value[value.length - 1].id);
      return;
    }
    if (atLimit) return;
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
      if (highlight < disponibles.length) {
        addProveedor(disponibles[highlight]);
      } else if (showCreateOption || showEmptyCreate) {
        startCreate();
      }
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      setQuery('');
    }
  };

  const isCell = variant === 'cell';

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
              Crear y agregar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={
          isCell
            ? 'flex min-h-9 flex-wrap items-center gap-1.5 bg-transparent px-1 py-1'
            : 'flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 shadow-sm focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20'
        }
        onClick={() => {
          if (!disabled && !atLimit) {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        {value.map((p, index) => (
          <span
            key={p.id}
            className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-900"
          >
            <span className="truncate">
              {index === 0 ? (
                <>
                  <span className="text-[10px] font-semibold uppercase text-primary-600">Ppal · </span>
                  {p.nombre}
                </>
              ) : (
                p.nombre
              )}
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                removeProveedor(p.id);
              }}
              className="shrink-0 rounded p-0.5 text-primary-700 hover:bg-primary-200"
              aria-label={`Quitar ${p.nombre}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}

        {!atLimit && (
          <div className="relative min-w-[140px] flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              disabled={disabled}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={
                value.length === 0
                  ? 'Buscar y agregar proveedores...'
                  : `Agregar otro (${value.length}/${max})...`
              }
              className="w-full border-0 bg-transparent py-1 pl-6 pr-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
            {isFetching && (
              <Loader2 size={14} className="absolute right-1 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
            )}
          </div>
        )}

        {atLimit && (
          <span className="px-1 text-[11px] text-slate-500">Máximo {max} proveedores</span>
        )}
      </div>

      {open && !atLimit && (
        <div
          id={listId}
          role="listbox"
          className={`absolute z-30 mt-0.5 max-h-64 w-full overflow-auto border border-slate-300 bg-white py-0.5 shadow-lg ${
            isCell ? '' : 'mt-1 rounded-lg border-slate-200'
          }`}
        >
          {disponibles.map((p, index) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={highlight === index}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => addProveedor(p)}
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
              aria-selected={highlight === disponibles.length}
              onMouseEnter={() => setHighlight(disponibles.length)}
              onClick={() => startCreate()}
              className={`flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-sm ${
                highlight === disponibles.length
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

          {!isFetching && disponibles.length === 0 && query.trim().length === 0 && (
            <p className="px-3 py-3 text-sm text-slate-500">
              Escribí para buscar y agregar hasta {max} proveedores.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
