import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CuentaCombobox } from '@/components/afectaciones/CuentaCombobox';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { SpreadsheetFormError } from '@/components/spreadsheet';
import { getCuentasArbol } from '@/services/cuentas.service';
import {
  getFondoARendirConfig,
  updateFondoARendirConfig,
} from '@/services/configuracion.service';
import { ApiClientError } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency } from '@/utils/format';
import type { CuentaDisponible, CuentaTreeNode } from '@/types';

function flattenCuentas(nodes: CuentaTreeNode[]): CuentaDisponible[] {
  const out: CuentaDisponible[] = [];
  const walk = (n: CuentaTreeNode) => {
    out.push({
      id: n.id,
      codigo: n.codigo,
      descripcion: n.descripcion,
      saldo_disponible: n.saldo_disponible,
    });
    n.hijos?.forEach(walk);
  };
  nodes.forEach(walk);
  return out.sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'));
}

export function ConfigCargosARendirPage() {
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission('configuracion:write'));
  const [selected, setSelected] = useState<CuentaDisponible | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['fondo-a-rendir'],
    queryFn: getFondoARendirConfig,
  });

  const { data: arbol, isLoading: loadingCuentas } = useQuery({
    queryKey: ['cuentas-arbol', 'fondo-a-rendir-options'],
    queryFn: () => getCuentasArbol({ estado: 'ACTIVA' }),
  });

  const options: CuentaDisponible[] = useMemo(
    () => flattenCuentas(arbol ?? []),
    [arbol]
  );

  useEffect(() => {
    if (!config) return;
    if (config.cuenta) {
      setSelected({
        id: config.cuenta.id,
        codigo: config.cuenta.codigo,
        descripcion: config.cuenta.descripcion,
        saldo_disponible: config.cuenta.saldo_disponible,
      });
      return;
    }
    setSelected(null);
  }, [config]);

  const mutation = useMutation({
    mutationFn: () => updateFondoARendirConfig(selected?.id ?? null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fondo-a-rendir'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas-disponibles'] });
      setError('');
      setSaved(true);
    },
    onError: (err) => {
      setSaved(false);
      setError(err instanceof ApiClientError ? err.message : 'Error al guardar');
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Fondo a rendir</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cuenta única que se imputa en los anticipos de cargos a rendir. No aparece en las
          afectaciones normales.
        </p>
      </div>

      {error && <SpreadsheetFormError>{error}</SpreadsheetFormError>}
      {saved && !error && (
        <Alert type="success">Se guardó la cuenta Fondo a rendir.</Alert>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Cuenta
        </label>
        {isLoading ? (
          <p className="text-sm text-slate-500">Cargando configuración…</p>
        ) : (
          <CuentaCombobox
            value={selected}
            onChange={(cuenta) => {
              setSaved(false);
              setSelected(cuenta);
            }}
            options={options}
            loading={loadingCuentas}
            disabled={!canWrite}
            placeholder="Buscar por código o descripción"
          />
        )}

        {config?.cuenta && config.cuenta.estado !== 'ACTIVA' && (
          <p className="mt-2 text-sm text-amber-700">
            La cuenta configurada no está activa. Elija otra o actívela en el plan de cuentas.
          </p>
        )}

        {selected && (
          <p className="mt-3 text-sm text-slate-600">
            Saldo disponible:{' '}
            <span className="font-medium tabular-nums">{formatCurrency(selected.saldo_disponible)}</span>
          </p>
        )}

        {canWrite && (
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              type="button"
              loading={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              Guardar
            </Button>
            {selected && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSelected(null);
                  setSaved(false);
                }}
              >
                Quitar selección
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
